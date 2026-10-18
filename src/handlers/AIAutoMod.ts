// ============================================
// Liberty City Bot - AI Auto-Moderation
// ============================================
// الـ AI يقرأ كل رسالة بنفسه ويقرر: سبام/سم/إباحي/احتيال/تهديد/تسريب بيانات
// يتصرف تلقائياً: يحذف/يحذر/يكتم/يبن + لاوج كامل

import {
  Message,
  Guild,
  GuildMember,
  TextChannel,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { AIHandler } from './AIHandler';
import { LibertyClient } from '../LibertyClient';
import { getGuildSettings, ModerationCase } from '../models';
import { createLogger } from '../utils/helpers';
import { Colors } from '../utils/embeds';

const logger = createLogger('AIAutoMod');

export interface AutoModConfig {
  enabled: boolean;
  // تصنيفات الكشف
  categories: {
    spam: boolean;           // رسائل متكررة/بوت
    toxicity: boolean;       // إهانات/شتائم/تنمر
    nsfw: boolean;           // محتوى جنسي صريح
    scam: boolean;           // روابط احتيالية/صيد/عملات مزيفة
    threat: boolean;         // تهديدات/عنف/إيذاء
    pii: boolean;            // تسريب بيانات شخصية (أرقام/عناوين/بطاقات)
    raid: boolean;           // رسائل هجوم/انضمام جماعي
    selfharm: boolean;       // إيذاء النفس/انتحار
  };
  // حساسية الكشف (1-10)
  sensitivity: number;
  // إجراء افتراضي لكل تصنيف
  actions: {
    spam: 'delete' | 'warn' | 'mute' | 'ban';
    toxicity: 'delete' | 'warn' | 'mute' | 'ban';
    nsfw: 'delete' | 'warn' | 'mute' | 'ban';
    scam: 'delete' | 'warn' | 'mute' | 'ban';
    threat: 'delete' | 'warn' | 'mute' | 'ban';
    pii: 'delete' | 'warn' | 'mute' | 'ban';
    raid: 'delete' | 'warn' | 'mute' | 'ban';
    selfharm: 'delete' | 'warn' | 'mute' | 'ban' | 'resources';
  };
  // مدة الكتم (دقائق)
  muteDuration: number;
  // قنوات مستثناة
  ignoredChannels: string[];
  // رولات مستثناة (الإدارة لا تُفحص)
  ignoredRoles: string[];
  // قناة لاوج
  logChannel?: string;
  // تصعيد تلقائي: لو تكرر 3 مرات في 10 دقايق → إجراء أعلى
  escalation: boolean;
  // الحد الأقصى للتحذيرات قبل تصعيد
  maxWarningsBeforeEscalation: number;
}

export interface AutoModResult {
  flagged: boolean;
  categories: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'delete' | 'warn' | 'mute' | 'ban' | 'resources' | 'none';
  reason: string;
  confidence: number; // 0-100
  suggestedResponse?: string; // رد مقترح للـ AI
}

const DEFAULT_CONFIG: AutoModConfig = {
  enabled: false,
  categories: {
    spam: true,
    toxicity: true,
    nsfw: true,
    scam: true,
    threat: true,
    pii: true,
    raid: true,
    selfharm: true,
  },
  sensitivity: 7,
  actions: {
    spam: 'delete',
    toxicity: 'warn',
    nsfw: 'delete',
    scam: 'ban',
    threat: 'ban',
    pii: 'delete',
    raid: 'mute',
    selfharm: 'resources',
  },
  muteDuration: 10,
  ignoredChannels: [],
  ignoredRoles: [],
  escalation: true,
  maxWarningsBeforeEscalation: 3,
};

export class AIAutoModHandler {
  private client: LibertyClient;
  private aiHandler: AIHandler;
  private warningCounts: Map<string, Map<string, number>> = new Map(); // guildId -> userId -> count
  private recentMessages: Map<string, { content: string; timestamp: number; userId: string }[]> = new Map();

  constructor(client: LibertyClient) {
    this.client = client;
    this.aiHandler = client.aiHandler;
  }

  // --------------------------------------------
  // نقطة الدخول: فحص رسالة
  // --------------------------------------------
  async scanMessage(message: Message): Promise<AutoModResult | null> {
    try {
      // تجاهل البوتات والويبهوكس
      if (message.author.bot || message.webhookId) return null;
      if (!message.guild) return null;

      const settings = await getGuildSettings(message.guild.id);
      const cfg = this.getConfig(settings);

      if (!cfg.enabled) return null;

      // تجاهل القنوات المستثناة
      if (cfg.ignoredChannels?.includes(message.channel.id)) return null;

      // تجاهل الرولات المستثناة
      if (message.member && cfg.ignoredRoles?.some(r => message.member!.roles.cache.has(r))) return null;

      // تجاهل الإدارة
      if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return null;

      // بناء السياق للـ AI
      const context = this.buildContext(message);

      // استدعاء الـ AI للتحليل
      const result = await this.analyzeWithAI(message, context, cfg);

      if (result.flagged) {
        await this.executeAction(message, result, cfg);
      }

      // تتبع الرسائل الحديثة للكشف عن السبام/الرائد
      this.trackMessage(message);

      return result;
    } catch (error: any) {
      logger.error(`AIAutoMod scanMessage error: ${error.message}`);
      return null;
    }
  }

  private getConfig(settings: any): AutoModConfig {
    const aiMod = settings.aiAutoMod;
    if (!aiMod) return DEFAULT_CONFIG;

    return {
      enabled: aiMod.enabled ?? false,
      categories: { ...DEFAULT_CONFIG.categories, ...aiMod.categories },
      sensitivity: aiMod.sensitivity ?? 7,
      actions: { ...DEFAULT_CONFIG.actions, ...aiMod.actions },
      muteDuration: aiMod.muteDuration ?? 10,
      ignoredChannels: aiMod.ignoredChannels ?? [],
      ignoredRoles: aiMod.ignoredRoles ?? [],
      logChannel: aiMod.logChannel,
      escalation: aiMod.escalation ?? true,
      maxWarningsBeforeEscalation: aiMod.maxWarningsBeforeEscalation ?? 3,
    };
  }

  private buildContext(message: Message): string {
    const guild = message.guild!;
    const member = message.member!;

    let ctx = `الرسالة: "${message.content}"\n`;
    ctx += `المستخدم: ${message.author.tag} (${message.author.id})\n`;
    ctx += `الرول الأعلى: ${member.roles.highest.name}\n`;
    ctx += `الرومات الحديثة في القناة: ${this.getRecentContext(message.channel.id)}\n`;

    // المرفقات
    if (message.attachments.size > 0) {
      ctx += `المرفقات: ${message.attachments.map(a => `${a.name} (${a.contentType})`).join(', ')}\n`;
    }

    return ctx;
  }

  private getRecentContext(channelId: string): string {
    const recent = this.recentMessages.get(channelId) || [];
    if (recent.length === 0) return 'لا توجد رسائل سابقة';
    return recent.slice(-5).map(m => `${m.userId}: ${m.content.substring(0, 50)}`).join(' | ');
  }

  private trackMessage(message: Message): void {
    const channelId = message.channel.id;
    const recent = this.recentMessages.get(channelId) || [];
    recent.push({
      content: message.content,
      timestamp: Date.now(),
      userId: message.author.id,
    });
    // نحتفظ بآخر 50 رسالة فقط
    if (recent.length > 50) recent.shift();
    this.recentMessages.set(channelId, recent);
  }

  // --------------------------------------------
  // التحليل بالـ AI
  // --------------------------------------------
  private async analyzeWithAI(message: Message, context: string, cfg: AutoModConfig): Promise<AutoModResult> {
    const activeCategories = Object.entries(cfg.categories)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join('، ');

    const prompt = `أنت نظام مراقبة محتوى متقدم (AI Auto-Moderator). حلّل الرسالة التالية وحدد إن كانت تنتهك السياسات.

**السياق:**
${context}

**التصنيفات المراقبة:** ${activeCategories}
**مستوى الحساسية:** ${cfg.sensitivity}/10

**تعليمات صارمة:**
1. حلّل بنية الرسالة، النية، والسياق — مش مجرد كلمات مفتاحية
2. اعتبر: سخرية، اقتباس، نقاش أكاديمي، مزاح بين أصدقاء = مش انتهاك
3. اعتبر: تكرار، توجيه للضحية، تصعيد، سياق عدائي = انتهاك
4. كن دقيقاً: الأفضل تفويت انتهاك طفيف من معاقبة بريء

**أجب بـ JSON فقط بالشكل التالي:**
{
  "flagged": boolean,
  "categories": ["spam", "toxicity", ...],
  "severity": "low|medium|high|critical",
  "action": "delete|warn|mute|ban|resources|none",
  "reason": "وصف مختصر للانتهاك",
  "confidence": 0-100,
  "suggestedResponse": "رد مقترح للـ AI العام (اختياري)"
}

**مهم:** لو مش متأكد (confidence < 60) → flagged: false`;

    try {
      const response = await this.aiHandler.generateResponse(
        'system-automod',
        message.guild!.id,
        message.channel.id,
        prompt,
        [],
        false,
        false,
        {
          fromCommand: true,
          userContext: undefined,
        }
      );

      if (!response?.content) {
        return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'لا يوجد رد من الـ AI', confidence: 0 };
      }

      // محاولة استخراج JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn(`AI AutoMod: لم يتم العثور على JSON في الرد: ${response.content.substring(0, 100)}`);
        return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'فشل تحليل الرد', confidence: 0 };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // تطبيق الحساسية
      if (parsed.confidence < cfg.sensitivity * 10) {
        return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'ثقة منخفضة', confidence: parsed.confidence };
      }

      // تحديد الإجراء بناءً على التصنيف
      const category = parsed.categories?.[0] || 'unknown';
      const action = cfg.actions[category as keyof typeof cfg.actions] || 'none';

      return {
        flagged: parsed.flagged || false,
        categories: parsed.categories || [],
        severity: parsed.severity || 'low',
        action,
        reason: parsed.reason || 'انتهاك مكتشف',
        confidence: parsed.confidence || 0,
        suggestedResponse: parsed.suggestedResponse,
      };
    } catch (error: any) {
      logger.error(`AI AutoMod analysis error: ${error.message}`);
      return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'خطأ في التحليل', confidence: 0 };
    }
  }

  // --------------------------------------------
  // تنفيذ الإجراء
  // --------------------------------------------
  private async executeAction(message: Message, result: AutoModResult, cfg: AutoModConfig): Promise<void> {
    const guild = message.guild!;
    const member = message.member!;
    const userId = message.author.id;

    try {
      // 1️⃣ حذف الرسالة (إذا كان الإجراء delete أو أعلى)
      if (['delete', 'warn', 'mute', 'ban'].includes(result.action)) {
        await message.delete().catch(() => {});
      }

      // 2️⃣ تنفيذ الإجراء
      switch (result.action) {
        case 'warn':
          await this.warnUser(guild, member, result.reason);
          break;
        case 'mute':
          await this.muteUser(guild, member, cfg.muteDuration, result.reason);
          break;
        case 'ban':
          await this.banUser(guild, member, result.reason);
          break;
        case 'resources':
          // إرسال موارد مساعدة (للـ self-harm)
          await this.sendHelpResources(message, result);
          break;
      }

      // 3️⃣ تتبع التحذيرات للتصعيد
      if (cfg.escalation && ['warn', 'mute'].includes(result.action)) {
        await this.trackWarning(guild.id, userId, result, cfg);
      }

      // 4️⃣ لاوج
      await this.logAction(guild, message, member, result, cfg);

    } catch (error: any) {
      logger.error(`AIAutoMod executeAction error: ${error.message}`);
    }
  }

  private async warnUser(guild: Guild, member: GuildMember, reason: string): Promise<void> {
    const result = await this.client.moderationHandler.warn({
      guild,
      moderator: guild.members.me!,
      target: member,
      reason: `AI Auto-Mod: ${reason}`,
    });
    logger.info(`AI Auto-Mod warned ${member.user.tag}: ${reason}`);
  }

  private async muteUser(guild: Guild, member: GuildMember, durationMinutes: number, reason: string): Promise<void> {
    if (!member.moderatable) return;
    await member.timeout(durationMinutes * 60 * 1000, `AI Auto-Mod: ${reason}`);
    logger.info(`AI Auto-Mod muted ${member.user.tag} for ${durationMinutes}m: ${reason}`);
  }

  private async banUser(guild: Guild, member: GuildMember, reason: string): Promise<void> {
    if (!member.bannable) return;
    await member.ban({ reason: `AI Auto-Mod: ${reason}`, deleteMessageSeconds: 0 });
    logger.info(`AI Auto-Mod banned ${member.user.tag}: ${reason}`);
  }

  private async sendHelpResources(message: Message, result: AutoModResult): Promise<void> {
    const resources = `💙 **نحن نهتم بك** — أنت لست وحدك:\n\n` +
      `🇸🇦 **السعودية:** 937 (الصحة النفسية) | 911 (الطوارئ)\n` +
      `🇪🇬 **مصر:** 08008880700 (الخط الساخن للصحة النفسية)\n` +
      `🇦🇪 **الإمارات:** 8004673 (Hope Line)\n` +
      `🌍 **دولي:** https://findahelpline.com/ — ابحث عن خط مساعدة في بلدك\n\n` +
      `**تواصل مع شخص تثق به الآن — حياتك تهمنا.**`;

    try {
      await message.author.send(resources).catch(() => {
        // لو الخاص مقفول، نرسل في القناة كرد عادي
        message.reply({ content: resources }).catch(() => {});
      });
    } catch {}
  }

  private async trackWarning(guildId: string, userId: string, result: AutoModResult, cfg: AutoModConfig): Promise<void> {
    const guildWarnings = this.warningCounts.get(guildId) || new Map();
    const userWarnings = guildWarnings.get(userId) || 0;
    const newCount = userWarnings + 1;
    guildWarnings.set(userId, newCount);
    this.warningCounts.set(guildId, guildWarnings);

    // تصعيد لو وصل للحد
    if (newCount >= cfg.maxWarningsBeforeEscalation) {
      const guild = this.client.guilds.cache.get(guildId);
      const member = guild?.members.cache.get(userId);
      if (member && member.moderatable) {
        await member.timeout(30 * 60 * 1000, `AI Auto-Mod: تصعيد تلقائي بعد ${newCount} تحذيرات`);
        logger.warn(`AI Auto-Mod escalated ${member.user.tag} to 30m mute (${newCount} warnings)`);
        
        // إعادة تعيين العداد
        guildWarnings.set(userId, 0);
      }
    }
  }

  private async logAction(
    guild: Guild,
    message: Message,
    member: GuildMember,
    result: AutoModResult,
    cfg: AutoModConfig
  ): Promise<void> {
    if (!cfg.logChannel) return;

    const logChannel = guild.channels.cache.get(cfg.logChannel) as TextChannel;
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setTitle(`🤖 AI Auto-Mod: ${result.action.toUpperCase()}`)
      .setColor(result.severity === 'critical' ? Colors.error : result.severity === 'high' ? Colors.warning : Colors.info)
      .addFields(
        { name: '👤 المستخدم', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: '📍 القناة', value: `${message.channel}`, inline: true },
        { name: '🏷️ التصنيف', value: result.categories.join('، '), inline: true },
        { name: '⚡ الإجراء', value: result.action, inline: true },
        { name: '📊 الخطورة', value: result.severity, inline: true },
        { name: '🎯 الثقة', value: `${result.confidence}%`, inline: true },
        { name: '📝 السبب', value: result.reason, inline: false },
        { name: '💬 الرسالة', value: message.content.substring(0, 500) || '(فارغة/مرفقات)', inline: false },
      )
      .setFooter({ text: 'Liberty City AI Auto-Mod' })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => {});
  }

  // --------------------------------------------
  // تحديث الإعدادات
  // --------------------------------------------
  async updateConfig(guildId: string, updates: Partial<AutoModConfig>): Promise<void> {
    const settings = await getGuildSettings(guildId);
    (settings as any).aiAutoMod = { ...this.getConfig(settings), ...updates };
    await settings.save();
  }

  async getConfigForGuild(guildId: string): Promise<AutoModConfig> {
    const settings = await getGuildSettings(guildId);
    return this.getConfig(settings);
  }
}

export default AIAutoModHandler;