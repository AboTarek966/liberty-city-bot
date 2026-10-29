// ============================================
// Liberty City Bot - Protection Handler
// ============================================

import {
  Client,
  Message,
  GuildMember,
  Collection,
  TextChannel,
  PermissionFlagsBits,
  ChannelType,
  AuditLogEvent,
  GuildVerificationLevel,
} from 'discord.js';
import { config } from '../config';
import { createLogger } from '../utils/helpers';
import { getGuildSettings, GuildSettings } from '../models';
import { setLockdown } from '../utils/lockdown';
import { globalThreat } from '../utils/threatScore';
import { scoreJoin } from '../utils/raidScoring';
import {
  containsInvite,
  extractUrls,
  getCapsPercentage,
  countEmojis,
  isZalgo,
} from '../utils/helpers';

const logger = createLogger('ProtectionHandler');

// --------------------------------------------
// Types
// --------------------------------------------
interface SpamTracker {
  messages: number;
  firstMessage: number;
  lastMessage: number;
}

interface RaidTracker {
  timestamps: number[];
  points: number[];
  firstJoin: number;
}

interface ProtectionAction {
  type: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  reason: string;
  duration?: number;
}

// --------------------------------------------
// Protection Handler Class
// --------------------------------------------
export class ProtectionHandler {
  private client: Client;
  
  // Trackers
  private spamTracker: Collection<string, SpamTracker> = new Collection(); // key: userId_channelId
  private raidTracker: Collection<string, RaidTracker> = new Collection(); // key: guildId
  private userCooldowns: Collection<string, number> = new Collection(); // key: userId_action
  // Beast Mode state
  private verificationState: Map<string, { applied: number; previous: number; at: number }> = new Map();
  private threatAlertCooldown: Map<string, number> = new Map();
  private recoveryTimers: Map<string, NodeJS.Timeout> = new Map();
  private lockdownRecoveryTimers: Map<string, NodeJS.Timeout> = new Map();
  constructor(client: Client) {
    this.client = client;
    // تنظيف دوري كل 5 دقائق لمنع تسرب الذاكرة
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
  }

  // --------------------------------------------
  // Webhook Spam Handler — Death Note / Raid Webhooks
  // --------------------------------------------
  private webhookSpamCooldown = new Map<string, number>();

  async handleWebhookMessage(message: Message): Promise<boolean> {
    if (!message.guild || !message.webhookId) return false;

    const settings = await getGuildSettings(message.guild.id);
    if (!settings.protection) return false;

    // فحص: هل الرسالة تحتوي @everyone أو mentions كتيرة أو رابط دعوة؟
    const isMassMention = message.mentions.everyone ||
                          message.mentions.users.size >= 5 ||
                          message.mentions.roles.size >= 3;
    const isInvite = /discord\.(gg|com\/invite)|discordapp\.com\/invite/i.test(message.content);
    const isScamLink = /(?:free|nitro|steam|airdrop|claim).*(?:discord\.gg|bit\.ly|tinyurl|cutt\.ly)/i.test(message.content);

    if (!isMassMention && !isInvite && !isScamLink) return false;

    // Rate limit: webhook cooldown 5 ثواني
    const key = `${message.guild.id}:${message.webhookId}`;
    const lastAction = this.webhookSpamCooldown.get(key) || 0;
    if (Date.now() - lastAction < 5000) {
      // احذف الرسالة فقط بدون تكرار الإجراء
      await message.delete().catch(() => {});
      return true;
    }
    this.webhookSpamCooldown.set(key, Date.now());

    // 1) احذف الرسالة فوراً
    await message.delete().catch(() => {});

    // 2) احذف الـ Webhook نفسه
    let webhookDeleted = false;
    try {
      const channel = message.channel;
      if (channel && 'webhooks' in channel) {
        const webhooks = await (channel as any).webhooks.fetch();
        const target = webhooks.find((w: any) => w.id === message.webhookId);
        if (target) {
          await target.delete('Liberty City — Anti-Webhook-Spam');
          webhookDeleted = true;
        }
      }
    } catch (e: any) {
      logger.warn(`Failed to delete webhook ${message.webhookId}: ${e.message}`);
    }

    // 3) ابحث عن المنفّذ عبر Audit Log
    let executor = null;
    try {
      const audit = await message.guild.fetchAuditLogs({ limit: 10, type: AuditLogEvent.WebhookCreate });
      const entry = audit.entries.find(e =>
        e.target?.id === message.webhookId &&
        Date.now() - e.createdTimestamp < 60000
      );
      if (entry) executor = entry.executor;
    } catch {}

    // 4) اعاقب المنفّذ لو موجود
    let punished = false;
    if (executor && !executor.bot) {
      try {
        const member = await message.guild.members.fetch(executor.id).catch(() => null);
        if (member && !member.permissions.has(PermissionFlagsBits.Administrator)) {
          await member.kick('Liberty City — Anti-Webhook-Spam (Death Note)');
          punished = true;
        }
      } catch {}
    }

    // 5) سجّل + أرسل تنبيه
    logger.warn(
      `🚨 WEBHOOK SPAM in ${message.guild.name}: deleted ${webhookDeleted ? 'webhook' : 'message only'}, ` +
      `punished=${punished}, executor=${executor?.tag || 'unknown'}, ` +
      `reason=${isMassMention ? '@everyone' : isInvite ? 'invite' : 'scam-link'}`
    );

    // إرسال تنبيه لقروم الحماية
    try {
      const logChannelId = settings.protection?.logChannel;
      if (logChannelId) {
        const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel && 'send' in logChannel) {
          const { EmbedBuilder } = await import('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('🚨 Webhook Spam — Death Note')
            .addFields(
              { name: 'القناة', value: (message.channel as any)?.name || 'unknown', inline: true },
              { name: 'حذف الـ Webhook', value: webhookDeleted ? '✅ نعم' : '❌ لا', inline: true },
              { name: 'المنفّذ', value: executor?.tag || 'غير معروف', inline: true },
              { name: 'العقوبة', value: punished ? '✅ تم طرد المنفّذ' : '❌ لم يتم', inline: true },
              { name: 'السبب', value: isMassMention ? '@everyone mass mention' : isInvite ? 'Invite link' : 'Scam link', inline: true },
            )
            .setTimestamp();
          await (logChannel as any).send({ embeds: [embed] });
        }
      }
    } catch {}

    return true;
  }

  // --------------------------------------------
  // Main Message Check
  // --------------------------------------------
  async checkMessage(message: Message): Promise<ProtectionAction | null> {
    if (!message.guild || !message.member) return null;

    // 🚨 Webhook messages — Death Note / Raid protection
    if (message.webhookId) {
      await this.handleWebhookMessage(message);
      return null;
    }

    if (message.author.bot) return null;

    const settings = await getGuildSettings(message.guild.id);

    // Skip if protection is disabled
    if (!settings.protection) return null;

    // Skip if user has ignored roles
    if (this.hasIgnoredRole(message.member, settings)) return null;

    // Skip if channel is ignored
    if (this.isIgnoredChannel(message.channel.id, settings)) return null;

    const hasAdministrator = message.member.permissions.has(PermissionFlagsBits.Administrator);
    const isAdmin = hasAdministrator ||
                    message.member.permissions.has(PermissionFlagsBits.ManageMessages);

    // Check each protection type — الإدارين يتجاوزون الحماية العامة فقط
    // requiresAdministrator: تجاوز الكلمات المحظورة (السب) لمن يملك Administrator فقط
    const checks = [
      { name: 'antiSpam', check: this.checkAntiSpam.bind(this), adminBypass: true },
      { name: 'antiLink', check: this.checkAntiLink.bind(this), adminBypass: true },
      { name: 'antiInvite', check: this.checkAntiInvite.bind(this), adminBypass: true },
      { name: 'antiMention', check: this.checkAntiMention.bind(this), adminBypass: true },
      { name: 'antiCaps', check: this.checkAntiCaps.bind(this), adminBypass: true },
      { name: 'antiEmoji', check: this.checkAntiEmoji.bind(this), adminBypass: true },
      { name: 'autoMod', check: this.checkAutoMod.bind(this), adminBypass: true, requiresAdministrator: true },
      { name: 'zalgo', check: this.checkZalgo.bind(this), adminBypass: false }, // للكل
    ];

    for (const { name, check, adminBypass, requiresAdministrator } of checks) {
      // ⚡ يتجاوز هذا الفحص؟ (الأمراء فقط للسب، وبقية الإدارين لبقية الحمايات)
      if (adminBypass && (requiresAdministrator ? hasAdministrator : isAdmin)) continue;
      
      const action = await check(message, settings);
      if (action) {
        await this.executeAction(message, action, settings);
        return action;
      }
    }

    return null;
  }

  // --------------------------------------------
  // Anti-Spam
  // --------------------------------------------
  private async checkAntiSpam(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { antiSpam } = settings.protection;
    if (!antiSpam.enabled) return null;

    const key = `${message.author.id}_${message.channel.id}`;
    const now = Date.now();
    const timeWindow = antiSpam.timeWindow;
    const maxMessages = antiSpam.maxMessages;

    let tracker = this.spamTracker.get(key);

    if (!tracker || now - tracker.firstMessage > timeWindow) {
      tracker = {
        messages: 1,
        firstMessage: now,
        lastMessage: now,
      };
      this.spamTracker.set(key, tracker);
      return null;
    }

    tracker.messages++;
    tracker.lastMessage = now;

    if (tracker.messages > maxMessages) {
      // Reset tracker
      this.spamTracker.delete(key);

      return {
        type: antiSpam.action as ProtectionAction['type'],
        reason: 'الرسائل المزعجة (Anti-Spam)',
        duration: antiSpam.muteDuration,
      };
    }

    return null;
  }

  // --------------------------------------------
  // Anti-Link
  // --------------------------------------------
  private async checkAntiLink(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { antiLink } = settings.protection;
    if (!antiLink.enabled) return null;

    // Check if user has ignored role
    if (antiLink.ignoreRoles?.some((roleId: string) => message.member?.roles.cache.has(roleId))) {
      return null;
    }

    const urls = extractUrls(message.content);
    if (urls.length === 0) return null;

    // Check if all URLs are whitelisted
    const nonWhitelistedUrls = urls.filter(url => {
      return !antiLink.whitelist.some((domain: string) => url.includes(domain));
    });

    if (nonWhitelistedUrls.length === 0) return null;

    return {
      type: antiLink.action as ProtectionAction['type'],
      reason: 'روابط غير مسموح بها (Anti-Link)',
    };
  }

  // --------------------------------------------
  // Anti-Invite
  // --------------------------------------------
  private async checkAntiInvite(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { antiInvite } = settings.protection;
    if (!antiInvite.enabled) return null;

    // Check if user has ignored role
    if (antiInvite.ignoreRoles?.some((roleId: string) => message.member?.roles.cache.has(roleId))) {
      return null;
    }

    if (!containsInvite(message.content)) return null;

    return {
      type: antiInvite.action as ProtectionAction['type'],
      reason: 'دعوات ديسكورد (Anti-Invite)',
    };
  }

  // --------------------------------------------
  // Anti-Mention
  // --------------------------------------------
  private async checkAntiMention(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { antiMention } = settings.protection;
    if (!antiMention.enabled) return null;

    const mentionCount = 
      message.mentions.users.size + 
      message.mentions.roles.size + 
      (message.mentions.everyone ? 2 : 0);

    if (mentionCount <= antiMention.max) return null;

    return {
      type: antiMention.action as ProtectionAction['type'],
      reason: 'المنشن الجماعي (Anti-Mention)',
    };
  }

  // --------------------------------------------
  // Anti-Caps
  // --------------------------------------------
  private async checkAntiCaps(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { antiCaps } = settings.protection;
    if (!antiCaps.enabled) return null;

    if (message.content.length < antiCaps.minLength) return null;

    const capsPercentage = getCapsPercentage(message.content);
    if (capsPercentage < antiCaps.percentage) return null;

    return {
      type: antiCaps.action as ProtectionAction['type'],
      reason: 'الأحرف الكبيرة (Anti-Caps)',
    };
  }

  // --------------------------------------------
  // Anti-Emoji
  // --------------------------------------------
  private async checkAntiEmoji(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { antiEmoji } = settings.protection;
    if (!antiEmoji.enabled) return null;

    const emojiCount = countEmojis(message.content);
    if (emojiCount <= antiEmoji.max) return null;

    return {
      type: antiEmoji.action as ProtectionAction['type'],
      reason: 'الإيموجي السبام (Anti-Emoji)',
    };
  }

  // --------------------------------------------
  // AutoMod (Bad Words)
  // --------------------------------------------
  private async checkAutoMod(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { automod } = settings;
    if (!automod || !automod.enabled) return null;

    // Check ignored roles
    if (automod.ignoredRoles?.some((roleId: string) => message.member?.roles.cache.has(roleId))) {
      return null;
    }

    const content = message.content.toLowerCase();
    
    const foundWord = automod.badWords.find((word: string) => 
      content.includes(word.toLowerCase())
    );

    if (!foundWord) return null;

    return {
      type: automod.badWordsAction as ProtectionAction['type'],
      reason: `كلمة محظورة: ${foundWord}`,
      duration: automod.badWordsDuration,
    };
  }

  // --------------------------------------------
  // Check Zalgo
  // --------------------------------------------
  private async checkZalgo(message: Message, settings: any): Promise<ProtectionAction | null> {
    const { automod } = settings;
    if (!automod || !automod.enabled || !automod.zalgoEnabled) return null;

    if (!isZalgo(message.content)) return null;

    return {
      type: automod.zalgoAction as ProtectionAction['type'],
      reason: 'Zalgo Text (Anti-Zalgo)',
    };
  }

  // --------------------------------------------
  // Execute Protection Action
  // --------------------------------------------
  private async executeAction(
    message: Message,
    action: ProtectionAction,
    settings: any
  ): Promise<void> {
    try {
      // Delete the message first
      if (message.deletable) {
        await message.delete().catch(() => {});
      }

      // Send warning to user
      const warningEmbed = {
        color: 0xff3366,
        title: '⚠️ تم حذف رسالتك',
        description: `سبب: ${action.reason}`,
        footer: { text: 'Liberty City Protection' },
        timestamp: new Date().toISOString(),
      };

      const warningMessage = message.channel.isTextBased() && 'send' in message.channel
        ? await message.channel.send({
            embeds: [warningEmbed],
          }).catch(() => null)
        : null;

      // Auto-delete warning after 5 seconds
      if (warningMessage) {
        setTimeout(() => {
          warningMessage.delete().catch(() => {});
        }, 5000);
      }

      // Execute action on user
      await this.executeUserAction(message, action);

      // Log to mod logs channel
      await this.logAction(message, action, settings);

      logger.info(`Protection action ${action.type} on ${message.author.tag}: ${action.reason}`);
    } catch (error) {
      logger.error('Failed to execute protection action:', error);
    }
  }

  // --------------------------------------------
  // Execute User Action
  // --------------------------------------------
  private async executeUserAction(message: Message, action: ProtectionAction): Promise<void> {
    const member = message.member;
    if (!member) return;

    // Check if bot can moderate
    if (!member.moderatable) return;

    switch (action.type) {
      case 'warn':
        // Warning is already shown
        break;

      case 'mute':
        await member.timeout(action.duration || 300000, action.reason).catch(() => {});
        break;

      case 'kick':
        await member.kick(action.reason).catch(() => {});
        break;

      case 'ban':
        await message.guild?.members.ban(message.author.id, {
          reason: action.reason,
          deleteMessageSeconds: 3600,
        }).catch(() => {});
        break;
    }
  }

  // --------------------------------------------
  // Log Action
  // --------------------------------------------
  private async logAction(message: Message, action: ProtectionAction, settings: any): Promise<void> {
    // Find log channel
    const logChannelId = settings.protection?.[this.getProtectionKey(action.reason)]?.logChannel 
      || settings.logging?.channelId;

    if (!logChannelId) return;

    const logChannel = message.guild?.channels.cache.get(logChannelId) as TextChannel;
    if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

    const logEmbed = {
      color: action.type === 'ban' || action.type === 'kick' ? 0xff3366 : 0xffd700,
      title: `🛡️ حماية: ${action.reason}`,
      fields: [
        { name: '👤 العضو', value: `${message.author} (${message.author.id})`, inline: true },
        { name: '📍 القناة', value: `${message.channel}`, inline: true },
        { name: '⚙️ الإجراء', value: action.type, inline: true },
        { name: '📝 الرسالة', value: message.content.substring(0, 1000) || 'N/A', inline: false },
      ],
      footer: { text: 'Liberty City Protection Logs' },
      timestamp: new Date().toISOString(),
    };

    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
  }

  // --------------------------------------------
  // Anti-Raid (Member Join)
  // --------------------------------------------
  async checkRaid(member: GuildMember): Promise<{ isRaid: boolean; action?: ProtectionAction }> {
    const settings = await getGuildSettings(member.guild.id);
    const { antiRaid } = settings.protection;

    if (!antiRaid.enabled) return { isRaid: false };

    const guildId = member.guild.id;
    const now = Date.now();
    const timeWindow = antiRaid.timeWindow || 60000;
    const threshold = antiRaid.threshold || 5;

    const beast = (antiRaid as any).beastMode || {};
    const beastEnabled = beast.enabled !== false;

    // Whitelist check (preemptive) — استثناء من الحظر الوقائي
    let whitelisted = false;
    try {
      whitelisted = await (this.client as any).securityHandler?.isPreemptivelyWhitelistedInGuild?.(guildId, member.id) ?? false;
    } catch {
      whitelisted = false;
    }

    // حساب نقاط اشتباه المنضم
    const createdMs = member.user.createdTimestamp || Date.now();
    const joinScore = scoreJoin({
      accountAgeMs: now - createdMs,
      hasAvatar: !!member.user.avatar,
      username: member.user.username,
      isBot: member.user.bot,
      minAccountAgeDays: beast.minAccountAgeDays ?? 7,
      requireAvatar: beast.requireAvatar !== false,
    });

    let tracker = this.raidTracker.get(guildId);
    if (!tracker || now - tracker.firstJoin > timeWindow) {
      tracker = { timestamps: [], points: [], firstJoin: now };
      this.raidTracker.set(guildId, tracker);
    }
    tracker.timestamps = tracker.timestamps.filter(t => now - t <= timeWindow);
    tracker.points = tracker.points.slice(tracker.points.length - tracker.timestamps.length);
    tracker.timestamps.push(now);
    tracker.points.push(joinScore.points);

    const recentJoins = tracker.timestamps.length;
    const suspicionPoints = tracker.points.reduce((a, b) => a + b, 0);
    const weighted = recentJoins + suspicionPoints;

    // Beast Mode: إذا كان الوضع مرتفعاً/حرجاً، طرد المنضمين المشبوهين فوراً (حتى تحت العتبة)
    if (beastEnabled && !whitelisted) {
      const snap = globalThreat.get(guildId, now);
      if ((snap.level === 'high' || snap.level === 'critical') && joinScore.suspicious) {
        const action: ProtectionAction = {
          type: (beast.suspiciousJoinAction === 'ban' ? 'ban' : 'kick'),
          reason: 'Beast Mode — منضم مشبوه أثناء تهديد مرتفع',
        };
        globalThreat.add(guildId, 2, 'suspicious join during threat');
        void this.applyBeastMode(member.guild, settings);
        return { isRaid: true, action };
      }
      if (snap.level === 'critical' && !whitelisted && member.user.bot === false) {
        // في الوضع الحرج: طرد أي حساب جديد (< 30 يوم) حتى لو wasn't flagged
        const ageDays = (now - createdMs) / (24 * 60 * 60 * 1000);
        if (ageDays < 30) {
          const action: ProtectionAction = { type: 'kick', reason: 'Beast Mode — وضع حرج: منع انضمام حسابات جديدة' };
          return { isRaid: true, action };
        }
      }
    }

    // Determine raid trigger
    const suspiciousTrigger = beastEnabled && recentJoins >= Math.max(3, Math.ceil(threshold / 2)) && suspicionPoints >= threshold;
    const isRaid = recentJoins > threshold || suspiciousTrigger;

    if (!isRaid) {
      // record mild threat for suspicious joins
      if (joinScore.suspicious) globalThreat.add(guildId, 2, 'suspicious join');
      return { isRaid: false };
    }

    // Raid detected!
    this.raidTracker.delete(guildId);
    globalThreat.add(guildId, 12, 'raid detected');

    const action: ProtectionAction = {
      type: antiRaid.action === 'lockdown' ? 'kick' : antiRaid.action,
      reason: 'هجوم DDoS/Raid على السيرفر',
    };

    if (antiRaid.action === 'lockdown') {
      await this.lockdown(member.guild);
      this.scheduleLockdownRecovery(member.guild, settings);
    }

    void this.applyBeastMode(member.guild, settings);
    return { isRaid: true, action };
  }

  // --------------------------------------------
  // Beast Mode: تصعيد/استعادة مستوى التحقق + تنبيه
  // --------------------------------------------
  async applyBeastMode(guild: any, settings: any): Promise<void> {
    try {
      const antiRaid = settings?.protection?.antiRaid;
      if (!antiRaid?.enabled) return;
      const beast = antiRaid.beastMode || {};
      if (beast.enabled === false) return;

      const guildId = guild.id;
      const snap = globalThreat.get(guildId);
      const currentLevel = guild.verificationLevel ?? 0;

      const escalate = beast.escalateVerification !== false;
      const autoRecoverMinutes = beast.autoRecoverMinutes ?? 15;

      if (snap.level === 'high' || snap.level === 'critical') {
        const targetLevel = snap.level === 'critical'
          ? GuildVerificationLevel.VeryHigh
          : GuildVerificationLevel.High;

        if (escalate && currentLevel < targetLevel) {
          try {
            await guild.setVerificationLevel(targetLevel, 'Liberty City Beast Mode');
            this.verificationState.set(guildId, { applied: targetLevel, previous: currentLevel, at: Date.now() });
          } catch (e: any) {
            // ignore permission errors
          }
        }

        // تنبيه (مرة كل 10 دقائق)
        const lastAlert = this.threatAlertCooldown.get(guildId) || 0;
        if (Date.now() - lastAlert > 10 * 60 * 1000) {
          this.threatAlertCooldown.set(guildId, Date.now());
          const logChannelId = antiRaid.logChannel || settings?.protection?.logChannel;
          const ch = logChannelId ? guild.channels.cache.get(logChannelId) : null;
          if (ch && 'send' in ch) {
            await (ch as any).send({
              content:
                `🧟 **Beast Mode — ${snap.level === 'critical' ? 'حرج' : 'مرتفع'}**\n` +
                `📊 الدرجة: ${snap.score}\n` +
                `📌 الأسباب: ${snap.reasons.join('، ') || '—'}\n` +
                `🔐 مستوى التحقق: ${snap.level === 'critical' ? 'الأعلى' : 'عالٍ'}\n` +
                `⏱️ استعادة تلقائية بعد ${autoRecoverMinutes} دقيقة من الهدوء.`,
            }).catch(() => {});
          }
        }

        this.scheduleRecovery(guild, settings, autoRecoverMinutes);
      }
    } catch (e: any) {
      // silent
    }
  }

  private scheduleRecovery(guild: any, settings: any, minutes: number): void {
    const guildId = guild.id;
    if (this.recoveryTimers.has(guildId)) return;
    const timer = setTimeout(async () => {
      this.recoveryTimers.delete(guildId);
      try {
        const snap = globalThreat.get(guildId);
        if (snap.level === 'high' || snap.level === 'critical') {
          // لا يزال مرتفعاً → أعد الجدولة
          this.scheduleRecovery(guild, settings, minutes);
          return;
        }
        const state = this.verificationState.get(guildId);
        if (state && guild.verificationLevel === state.applied) {
          try {
            await guild.setVerificationLevel(state.previous, 'Liberty City Beast Mode recovery');
          } catch {}
        }
        this.verificationState.delete(guildId);
      } catch {}
    }, minutes * 60 * 1000);
    timer.unref?.();
    this.recoveryTimers.set(guildId, timer);
  }

  private scheduleLockdownRecovery(guild: any, settings: any): void {
    const guildId = guild.id;
    if (this.lockdownRecoveryTimers.has(guildId)) return;
    const minutes = (settings?.protection?.antiRaid?.beastMode?.autoRecoverMinutes ?? 15);
    const timer = setTimeout(async () => {
      this.lockdownRecoveryTimers.delete(guildId);
      try {
        // لا تفتح إذا كان وضع الطوارئ اليدوي مفعّلاً
        const fresh = await getGuildSettings(guildId);
        if (fresh?.protection?.lockdown) return;
        const snap = globalThreat.get(guildId);
        if (snap.level === 'high' || snap.level === 'critical') {
          this.scheduleLockdownRecovery(guild, settings);
          return;
        }
        await setLockdown(guild, false);
      } catch {}
    }, minutes * 60 * 1000);
    timer.unref?.();
    this.lockdownRecoveryTimers.set(guildId, timer);
  }

  // --------------------------------------------
  // Lockdown
  // --------------------------------------------
  private async lockdown(guild: any): Promise<void> {
    const channels = guild.channels.cache.filter((c: any) => 
      c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice
    );

    for (const channel of channels.values()) {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
          Connect: false,
        }, { reason: 'Anti-Raid Lockdown' });
      } catch (error) {
        logger.error(`Failed to lockdown channel ${channel.name}:`, error);
      }
    }

    logger.info(`Locked down guild ${guild.name}`);
  }

  // --------------------------------------------
  // Utility Methods
  // --------------------------------------------
  private hasIgnoredRole(member: GuildMember, settings: any): boolean {
    const ignoredRoles = [
      ...(settings.protection?.antiLink?.ignoreRoles || []),
      ...(settings.protection?.antiInvite?.ignoreRoles || []),
      ...(settings.automod?.ignoredRoles || []),
    ];

    return ignoredRoles.some((roleId: string) => member.roles.cache.has(roleId));
  }

  private isIgnoredChannel(channelId: string, settings: any): boolean {
    const ignoredChannels = [
      ...(settings.automod?.ignoredChannels || []),
      ...(settings.logging?.ignoredChannels || []),
    ];

    return ignoredChannels.includes(channelId);
  }

  private getProtectionKey(reason: string): string {
    if (reason.includes('Anti-Spam')) return 'antiSpam';
    if (reason.includes('Anti-Link')) return 'antiLink';
    if (reason.includes('Anti-Invite')) return 'antiInvite';
    if (reason.includes('Anti-Mention')) return 'antiMention';
    if (reason.includes('Anti-Caps')) return 'antiCaps';
    if (reason.includes('Anti-Emoji')) return 'antiEmoji';
    return 'antiRaid';
  }

  // --------------------------------------------
  // Cleanup Old Trackers
  // --------------------------------------------
  cleanup(): void {
    const now = Date.now();

    // Clean spam trackers
    this.spamTracker.forEach((tracker, key) => {
      if (now - tracker.lastMessage > 30000) { // 30 seconds
        this.spamTracker.delete(key);
      }
    });

    // Clean raid trackers
    this.raidTracker.forEach((tracker, guildId) => {
      if (!tracker.timestamps.length || now - tracker.firstJoin > 300000) { // 5 minutes
        this.raidTracker.delete(guildId);
      }
    });

    // Clean user cooldowns
    this.userCooldowns.forEach((timestamp, key) => {
      if (now - timestamp > 300000) { // 5 minutes
        this.userCooldowns.delete(key);
      }
    });

    // Clean webhook spam cooldown (older than 1 minute)
    for (const [key, timestamp] of this.webhookSpamCooldown) {
      if (now - timestamp > 60000) {
        this.webhookSpamCooldown.delete(key);
      }
    }
  }
}

export default ProtectionHandler;