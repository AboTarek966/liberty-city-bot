// ============================================
// Liberty City Bot - Message Scanner Handler
// ============================================
// يفحص الروابط والمرفقات عبر VirusTotal API

import { Message, Guild, TextChannel, Attachment } from 'discord.js';
import { getGuildSettings } from '../models';
import { createLogger } from '../utils/helpers';

const logger = createLogger('MessageScannerHandler');

interface ScanResult {
  clean: boolean;
  threat: string;
  details: string;
  engine: string;
}

export class MessageScannerHandler {
  private virusTotalApiKey: string;
  private scanCache: Map<string, { result: ScanResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // ساعة واحدة

  constructor(virusTotalApiKey?: string) {
    this.virusTotalApiKey = virusTotalApiKey || process.env.VIRUSTOTAL_API_KEY || '';
  }

  setApiKey(key: string): void {
    this.virusTotalApiKey = key;
  }

  // --------------------------------------------
  // نقطة الدخول: فحص رسالة
  // --------------------------------------------
  async scanMessage(message: Message): Promise<void> {
    try {
      const settings = await getGuildSettings(message.guild?.id || '');
      const cfg = settings.protection?.messageScanner;
      if (!cfg?.enabled) return;

      // تجاهل رسائل البوتات والإدارة
      if (message.author.bot) return;
      if (message.member?.permissions.has('Administrator')) return;
      if (cfg.whitelistDomains?.some((d: string) => message.content.includes(d))) return;

      // 1️⃣ فحص الروابط في النص
      if (cfg.scanLinks) {
        const urls = this.extractUrls(message.content);
        for (const url of urls) {
          if (cfg.whitelistDomains?.some((d: string) => url.includes(d))) continue;
          const result = await this.scanUrl(url);
          if (!result.clean) {
            await this.handleThreat(message, `رابط خبيث: ${url}`, result, cfg);
            return; // نكتفي بأول تهديد
          }
        }
      }

      // 2️⃣ فحص المرفقات
      if (cfg.scanAttachments && message.attachments.size > 0) {
        for (const [, attachment] of message.attachments) {
          const result = await this.scanAttachment(attachment);
          if (!result.clean) {
            await this.handleThreat(message, `ملف خبيث: ${attachment.name}`, result, cfg);
            return;
          }
        }
      }
    } catch (error: any) {
      logger.error(`MessageScanner scanMessage error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // استخراج الروابط من النص
  // --------------------------------------------
  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"']+/gi;
    const matches = text.match(urlRegex);
    return matches || [];
  }

  // --------------------------------------------
  // فحص رابط عبر VirusTotal
  // --------------------------------------------
  async scanUrl(url: string): Promise<ScanResult> {
    // فحص الكاش أولاً
    const cached = this.scanCache.get(`url:${url}`);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    if (!this.virusTotalApiKey) {
      return { clean: true, threat: '', details: 'لا يوجد VirusTotal API Key', engine: 'none' };
    }

    try {
      // VirusTotal URL Scan API v3
      const encodedUrl = Buffer.from(url).toString('base64').replace(/=/g, '');
      
      const response = await fetch(`https://www.virustotal.com/api/v3/urls/${encodedUrl}`, {
        headers: { 'x-apikey': this.virusTotalApiKey },
      });

      if (!response.ok) {
        // إذا لم يكن الرابط مفحوص مسبقاً، نرسله للفحص
        if (response.status === 404) {
          return await this.submitUrlForScan(url);
        }
        throw new Error(`VT API error: ${response.status}`);
      }

      const data: any = await response.json();
      const stats = data.data?.attributes?.last_analysis_stats || {};
      const malicious = stats.malicious || 0;
      const suspicious = stats.suspicious || 0;

      const result: ScanResult = {
        clean: malicious === 0 && suspicious === 0,
        threat: malicious > 0 ? 'malicious' : suspicious > 0 ? 'suspicious' : '',
        details: `محركات: ${malicious} ضار، ${suspicious} مشبوه من ${Object.values(stats).reduce((a: number, b: any) => a + b, 0)}`,
        engine: 'VirusTotal',
      };

      this.scanCache.set(`url:${url}`, { result, timestamp: Date.now() });
      return result;
    } catch (error: any) {
      logger.warn(`VirusTotal URL scan failed for ${url}: ${error.message}`);
      return { clean: true, threat: '', details: `فشل الفحص: ${error.message}`, engine: 'VirusTotal' };
    }
  }

  private async submitUrlForScan(url: string): Promise<ScanResult> {
    try {
      const response = await fetch('https://www.virustotal.com/api/v3/urls', {
        method: 'POST',
        headers: {
          'x-apikey': this.virusTotalApiKey,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: `url=${encodeURIComponent(url)}`,
      });

      if (!response.ok) throw new Error(`Submit failed: ${response.status}`);

      const data: any = await response.json();
      const analysisId = data.data?.id;
      
      // ننتظر قليلاً ونفحص النتيجة
      await new Promise(r => setTimeout(r, 3000));
      return this.scanUrl(url); // استدعاء متكرر للفحص
    } catch (error: any) {
      logger.warn(`VirusTotal submit failed for ${url}: ${error.message}`);
      return { clean: true, threat: '', details: `فشل الإرسال: ${error.message}`, engine: 'VirusTotal' };
    }
  }

  // --------------------------------------------
  // فحص مرفق عبر VirusTotal
  // --------------------------------------------
  async scanAttachment(attachment: Attachment): Promise<ScanResult> {
    const cacheKey = `file:${attachment.id}:${attachment.size}`;
    const cached = this.scanCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    if (!this.virusTotalApiKey) {
      return { clean: true, threat: '', details: 'لا يوجد VirusTotal API Key', engine: 'none' };
    }

    // نتحقق من حجم الملف (VT limite 32MB للملفات المجانية)
    if (attachment.size > 32 * 1024 * 1024) {
      return { clean: true, threat: '', details: 'ملف أكبر من 32MB — لا يمكن فحصه', engine: 'VirusTotal' };
    }

    try {
      // تحميل الملف
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error(`فشل تحميل الملف: ${response.status}`);
      const fileBuffer = await response.arrayBuffer();

      // رفع الملف لـ VirusTotal
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), attachment.name || 'file');

      const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
        method: 'POST',
        headers: { 'x-apikey': this.virusTotalApiKey },
        body: formData,
      });

      if (!uploadResponse.ok) {
        if (uploadResponse.status === 413) {
          return { clean: true, threat: '', details: 'ملف كبير جداً', engine: 'VirusTotal' };
        }
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadData: any = await uploadResponse.json();
      const analysisId = uploadData.data?.id;

      // انتظار التحليل
      await new Promise(r => setTimeout(r, 5000));
      
      const analysisResponse = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { 'x-apikey': this.virusTotalApiKey },
      });

      if (!analysisResponse.ok) throw new Error(`Analysis fetch failed: ${analysisResponse.status}`);

      const analysisData: any = await analysisResponse.json();
      const stats = analysisData.data?.attributes?.stats || {};
      const malicious = stats.malicious || 0;
      const suspicious = stats.suspicious || 0;

      const result: ScanResult = {
        clean: malicious === 0 && suspicious === 0,
        threat: malicious > 0 ? 'malicious' : suspicious > 0 ? 'suspicious' : '',
        details: `محركات: ${malicious} ضار، ${suspicious} مشبوه من ${Object.values(stats).reduce((a: number, b: any) => a + b, 0)}`,
        engine: 'VirusTotal',
      };

      this.scanCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error: any) {
      logger.warn(`VirusTotal file scan failed for ${attachment.name}: ${error.message}`);
      return { clean: true, threat: '', details: `فشل الفحص: ${error.message}`, engine: 'VirusTotal' };
    }
  }

  // --------------------------------------------
  // التعامل مع التهديد
  // --------------------------------------------
  private async handleThreat(message: Message, reason: string, result: ScanResult, cfg: any): Promise<void> {
    const guild = message.guild;
    if (!guild) return;

    try {
      // تنفيذ الإجراء
      switch (cfg.action) {
        case 'ban':
          if (message.member?.bannable) {
            await message.member.ban({ reason: `Message Scanner: ${reason}`, deleteMessageSeconds: 0 });
          }
          break;
        case 'kick':
          if (message.member?.kickable) {
            await message.member.kick(`Message Scanner: ${reason}`);
          }
          break;
        case 'mute':
          if (message.member?.moderatable) {
            await message.member.timeout(10 * 60 * 1000, `Message Scanner: ${reason}`);
          }
          break;
        case 'delete':
        default:
          await message.delete().catch(() => {});
          break;
      }

      // لاوج
      if (cfg.logChannel) {
        const logChannel = guild.channels.cache.get(cfg.logChannel) as TextChannel;
        if (logChannel) {
          await logChannel.send({
            content: `🔍 **Message Scanner — تهديد مكتشف**\n` +
              `👤 **المرسل:** ${message.author.tag} (\`${message.author.id}\`)\n` +
              `📍 **الروم:** ${message.channel}\n` +
              `⚠️ **النوع:** ${reason}\n` +
              `🛡️ **المحرك:** ${result.engine}\n` +
              `📝 **التفاصيل:** ${result.details}\n` +
              `⚡ **الإجراء:** ${cfg.action}`,
          }).catch(() => {});
        }
      }

      logger.warn(`Message Scanner threat in ${guild.name}: ${message.author.tag} — ${reason} — ${cfg.action}`);
    } catch (error: any) {
      logger.error(`MessageScanner handleThreat error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // فحص يدوي: /scanurl <url> أو /scanfile <attachment>
  // --------------------------------------------
  async manualScanUrl(url: string): Promise<ScanResult> {
    return this.scanUrl(url);
  }

  async manualScanFile(attachment: Attachment): Promise<ScanResult> {
    return this.scanAttachment(attachment);
  }
}

export default MessageScannerHandler;