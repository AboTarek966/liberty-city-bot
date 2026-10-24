// ============================================
// Liberty City Bot - Security Handler (Anti-Nuke Suite)
// حزمة الحماية الشاملة ضد اختراق السيرفر:
//  1) Anti-Nuke   : كشف الحذف الجماعي (قنوات/رولات/باند) + معاقبة المخالف
//  2) Anti-Bot    : طرد البوتات غير المصرح بها
//  3) Anti-Admin  : تنبيه/عقوبة عند منح صلاحية Administrator
//  4) Auto-Backup : نسخ احتياطي دوري لبنية السيرفر + الاستعادة
// ============================================

import {
  Client,
  Guild,
  GuildMember,
  User,
  Role,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  AuditLogEvent,
  EmbedBuilder,
} from 'discord.js';
import { createLogger } from '../utils/helpers';
import { getGuildSettings, BackupConfig } from '../models';
import { Colors } from '../utils/embeds';

const logger = createLogger('SecurityHandler');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// أنواع القنوات القابلة لإعادة الإنشاء
const RESTORABLE_CHANNEL_TYPES: number[] = [
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.GuildCategory,
  ChannelType.GuildMedia,
];

interface DeletionTracker {
  channel: number[];
  role: number[];
  ban: number[];
  kick: number[];
  emoji: number[];
  sticker: number[];
}

/** عضو طُرد — نحتفظ به حتى نرسله رابط الدعوة لاستعادته */
interface KickedEntry {
  userId: string;
  tag: string;
  at: number;
}

/** لقطة رسائل — لاستعادة الحذف الجماعي */
interface MessageSnapshot {
  channelId: string;
  messages: Array<{
    id: string;
    content: string;
    authorId: string;
    authorTag: string;
    attachments: Array<{ url: string; name: string }>;
    embeds: any[];
    timestamp: number;
  }>;
  at: number;
}

/** تتبّع حذف الرسائل: guildId → channelId → timestamps */
interface MessageDeletionTracker {
  [channelId: string]: number[];
}

/** نتيجة فحص تسلّم البوت — أهم مؤشر أمني في السيرفر */
export interface HierarchyStatus {
  /** true = البوت يملك أعلى رتبة (يقدر يعاقب أي أحد) */
  ok: boolean;
  /** اسم أعلى رتبة للبوت */
  botRoleName: string;
  /** موقع أعلى رتبة للبوت */
  botPosition: number;
  /** الرولات الأعلى من البوت (يتعذّر معاقبة أصحابها) */
  offenders: string[];
  /** عدد الرولات فوق البوت */
  offenderCount: number;
  /** هل يوجد رول فوق البوت يحمل أي صلاحيات خطيرة */
  dangerous: boolean;
}

/**
 * 🛡️ فحص تسلّم البوت — أهم مؤشر أمني في السيرفر
 *
 * Discord يمنع المساس بأحد أعلى منك في الرتب مهما كانت صلاحياتك،
 * فلو رول المهاجم فوق رول البوت: `ban`/`kick`/سحب الرولات **تفشل كلها بصمت**.
 * هذا الفحص هو ما يميّز حماية حقيقية عن حماية ورقية.
 *
 * دالة مستقلة (لا تعتمد على `this`) لتُختبر وتُستخدم من لوحة الإعدادات.
 */
export function computeHierarchy(guild: Guild): HierarchyStatus {
  const me = guild.members.me;
  if (!me) {
    return { ok: false, botRoleName: '—', botPosition: -1, offenders: [], offenderCount: 0, dangerous: false };
  }

  const botTop = me.roles.highest;
  const botPosition = botTop.position;

  const DANGEROUS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ModerateMembers,
  ];

  const above = guild.roles.cache.filter(
    r =>
      r.id !== guild.id &&            // ليس @everyone
      !r.managed &&                   // رولات التكاملات تُستثنى
      r.id !== botTop.id &&
      r.position > botPosition
  );

  const offenders = above
    .sort((a, b) => b.position - a.position)
    .map(r => `${r.name} (\`#${r.position}\`)`)
    .slice(0, 15);

  const dangerous = above.some(r => DANGEROUS.some(p => r.permissions.has(p)));

  return {
    ok: above.size === 0,
    botRoleName: botTop.name,
    botPosition,
    offenders,
    offenderCount: above.size,
    dangerous,
  };
}

export class SecurityHandler {
  private client: Client;

  // تتبّع عمليات الحذف: guildId → { نوع → توقيتات }
  private deletionTracker: Map<string, DeletionTracker> = new Map();

  // 🔥 تتبّع حذف الرسائل الجماعي: guildId → channelId → timestamps
  private messageDeletionTracker: Map<string, MessageDeletionTracker> = new Map();

  // 📸 لقطات رسائل للاستعادة الفورية: guildId → channelId → MessageSnapshot
  private messageSnapshots: Map<string, Map<string, MessageSnapshot>> = new Map();

  // تتبّع تغيير الأسماء السريع: key → توقيتات
  private renameTracker: Map<string, number[]> = new Map();

  // مؤقتات النسخ الاحتياطي التلقائي
  private backupTimers: Map<string, NodeJS.Timeout> = new Map();

  // 🔍 مؤقتات الفحص الدوري (كشف هاكر كل N ساعات)
  private scanTimers: Map<string, NodeJS.Timeout> = new Map();

  // آخر حالة تسلّم مُبلَّغ عنها لكل سيرفر (ننبّه فقط عند تغيّر الحالة)
  private hierarchyState: Map<string, boolean> = new Map();

  // مؤقتات الاستعادة التلقائية المؤجلة (تُجمَّع عدة حذفات في استعادة واحدة)
  private restoreTimers: Map<string, NodeJS.Timeout> = new Map();

  // 🔒 مقفل استعادة لكل سيرفر — يمنع إنشاء قنوات مكرّرة عند التزامن
  private restoreLocks: Map<string, Promise<{ channels: number; roles: number; skipped: number }>> =
    new Map();

  // 👢 المطرودون بانتظار إرسال رابط الدعوة (استعادة تلقائية)
  //    الطرد لا يُلغى في ديسكورد — الطريقة الوحيدة لإرجاعهم هي الرابط
  private kickedQueue: Map<string, KickedEntry[]> = new Map();
  private kickedTimers: Map<string, NodeJS.Timeout> = new Map();

  // Pro Max: sticky role watchdog timers
  private topWatchdogs: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  // --------------------------------------------
  // تنظيف كل موارد السيرفر — يُستدعى عند مغادرة البوت (guildDelete)
  // حتى لا تبقى مؤقتات/كاش/بيانات تخص سيرفر البوت خرج منه
  // --------------------------------------------
  clearGuild(guildId: string): void {
    const clearOne = (m: Map<string, NodeJS.Timeout>) => {
      const t = m.get(guildId);
      if (t) {
        clearInterval(t);
        clearTimeout(t);
        m.delete(guildId);
      }
    };
    clearOne(this.backupTimers);
    clearOne(this.scanTimers);
    clearOne(this.restoreTimers);
    clearOne(this.kickedTimers);
    clearOne(this.topWatchdogs);
    clearOne(this.messageSnapshotInterval);
    this.deletionTracker.delete(guildId);
    this.messageDeletionTracker.delete(guildId);
    this.messageSnapshots.delete(guildId);
    this.renameTracker.delete(guildId);
    this.hierarchyState.delete(guildId);
    this.restoreLocks.delete(guildId);
    this.kickedQueue.delete(guildId);
    logger.info(`🧹 Cleared all per-guild resources for ${guildId}`);
  }

  cleanup(): void {
    for (const timer of this.backupTimers.values()) clearInterval(timer);
    this.backupTimers.clear();
    for (const timer of this.scanTimers.values()) clearInterval(timer);
    this.scanTimers.clear();
    for (const timer of this.restoreTimers.values()) clearTimeout(timer);
    this.restoreTimers.clear();
    this.restoreLocks.clear();
    for (const timer of this.kickedTimers.values()) clearTimeout(timer);
    this.kickedTimers.clear();
    this.kickedQueue.clear();
    // Cleanup message snapshots (older than 1 hour)
    for (const [guildId, channels] of this.messageSnapshots) {
      for (const [channelId, snapshot] of channels) {
        if (Date.now() - snapshot.at > 3600000) {
          channels.delete(channelId);
        }
      }
      if (channels.size === 0) this.messageSnapshots.delete(guildId);
    }
    // Cleanup message deletion trackers
    for (const [guildId, tracker] of this.messageDeletionTracker) {
      const now = Date.now();
      for (const channelId of Object.keys(tracker)) {
        tracker[channelId] = tracker[channelId].filter(t => now - t <= 60000);
        if (tracker[channelId].length === 0) delete tracker[channelId];
      }
      if (Object.keys(tracker).length === 0) this.messageDeletionTracker.delete(guildId);
    }
  }

  // --------------------------------------------
  // Helpers
  // --------------------------------------------

  // قناة تنبيهات الأمن: مخصصة → حماية عامة → أنتينوك → سجلات → نظام → أول قناة قابلة للإرسال
  private async getAlertChannel(guild: Guild, settings: any, specific?: string): Promise<TextChannel | null> {
    const candidates = [
      specific,
      settings?.protection?.logChannel,
      settings?.protection?.antiNuke?.logChannel,
      settings?.logging?.channelId,
    ];

    for (const id of candidates) {
      if (!id) continue;
      const channel = guild.channels.cache.get(id);
      if (channel && channel.isTextBased() && 'send' in channel) {
        return channel as TextChannel;
      }
    }

    if (guild.systemChannel) return guild.systemChannel;

    const me = guild.members.me;
    if (!me) return null;

    return (
      (guild.channels.cache.find(c => {
        if (c.type !== ChannelType.GuildText) return false;
        const perms = c.permissionsFor(me);
        return !!perms?.has(PermissionFlagsBits.SendMessages) && !!perms?.has(PermissionFlagsBits.EmbedLinks);
      }) as TextChannel) || null
    );
  }

  // تحديد المنفّذ من سجلات التدقيق
  private async findExecutor(guild: Guild, type: AuditLogEvent, targetId?: string): Promise<User | null> {
    try {
      const logs = await guild.fetchAuditLogs({ type, limit: 5 });
      const recent = logs.entries.filter(e => Date.now() - e.createdTimestamp < 20000);
      const entry = (targetId ? recent.find(e => e.targetId === targetId) : undefined) ?? recent.first();
      const executor = entry?.executor;
      return executor ? (executor as User) : null;
    } catch (error: any) {
      logger.warn(`fetchAuditLogs failed in ${guild.name}: ${error.message}`);
      return null;
    }
  }

  // معاقبة المخالف (تجاهل: المالك، البوت نفسه، غير الموجود)
  // نوع العقوبة: alert | kick | ban | strip (سلب كل الرولات)
  private async punish(
    guild: Guild,
    executor: User,
    action: 'alert' | 'kick' | 'ban' | 'strip',
    reason: string
  ): Promise<string> {
    if (executor.id === guild.ownerId) return '⏭️ المالك مستثناً';
    if (executor.id === this.client.user?.id) return '⏭️ البوت مستثنى';
    const devId = process.env.DEVELOPER_USER_ID;
    if (devId && executor.id === devId) return '⏭️ مطوّر البوت مستثنى';

    const member =
      guild.members.cache.get(executor.id) ||
      (await guild.members.fetch(executor.id).catch(() => null));
    if (!member) return '⚠️ المخالف لم يعد عضواً';

    // 🛡️ فحص التسلّم قبل التنفيذ — أخطر حالة: عقوبة تفشل بصمت
    const me = guild.members.me;
    if (me) {
      const botTop = me.roles.highest;
      const targetTop = member.roles.highest;

      if (targetTop.comparePositionTo(botTop) >= 0) {
        // نبلّغ عن مشكلة التسلّم (تنبيه واحد فقط عند التغيّر)
        void this.ensureHierarchyAlert(guild);
        return (
          `⛔ **رتبته فوق البوت** (‎${targetTop.name}‎ ≥ ‎${botTop.name}‎) — ` +
          `العقوبة مستحيلة. اسحب رول البوت لأعلى القائمة`
        );
      }
    }

    try {
      if (action === 'ban') {
        await member.ban({ reason });
        return '🔨 تم حظر المخالف';
      }
      if (action === 'kick') {
        await member.kick(reason);
        return '👢 تم طرد المخالف';
      }
      if (action === 'strip') {
        const target = [...member.roles.cache.values()].filter(
          r => r.id !== guild.id && !r.managed
        );
        if (target.length === 0) return '⚠️ المخالف بلا رولات لسحبها';

        let removed = 0;
        for (const role of target) {
          // كل رولة على حدة — لو فشلت واحدة بسبب التسلّم نكمل الباقي
          const ok = await role
            .delete(`Liberty City Anti-Nuke: ${reason}`)
            .then(() => true)
            .catch(() => false);
          if (ok) removed++;
        }

        if (removed === 0) {
          void this.ensureHierarchyAlert(guild);
          return (
            `⛔ تعذّر سلب أي رولة من ${target.length} — ` +
            `تحقّق من تسلّم البوت (ارفع رول البوت للأعلى)`
          );
        }
        return `🗡️ تم سلب **${removed}/${target.length}** رولة — باقٍ في السيرفر بلا صلاحيات`;
      }
    } catch (error: any) {
      logger.warn(`punish failed (${action}) in ${guild.name}: ${error.message}`);
      void this.ensureHierarchyAlert(guild);
      return `⚠️ فشل التنفيذ (${error.message}) — راجع تسلّم البوت`;
    }

    return '📢 تم الإشعار فقط';
  }

  // تتبّع الحذف → يعيد العدد داخل النافذة الزمنية
  private track(guildId: string, type: 'channel' | 'role' | 'ban' | 'kick' | 'emoji' | 'sticker', windowMs: number): number {
    const now = Date.now();
    let tracker = this.deletionTracker.get(guildId);
    if (!tracker) {
      tracker = { channel: [], role: [], ban: [], kick: [], emoji: [], sticker: [] };
      this.deletionTracker.set(guildId, tracker);
    }

    tracker[type].push(now);
    tracker[type] = tracker[type].filter(t => now - t <= windowMs);
    return tracker[type].length;
  }

  // --------------------------------------------
  // 0) HIERARCHY GUARD — فحص تسلّم البوت
  // --------------------------------------------
  // أهم فحص أمني: لو رول فوق البوت، كل العقوبات تفشل بصمت
  // (Discord يمنع المساس بأحد أعلى منك في الرتب مهما كانت صلاحياتك)
  checkHierarchy(guild: Guild): HierarchyStatus {
    return computeHierarchy(guild);
  }

  /**
   * يبلّغ عن مشكلة التسلّم — **عند تغيّر الحالة فقط** حتى لا نكرّر التنبيه
   * يستدعى: عند الإقلاع، عند الانضمام، وعند كل محاولة عقوبة فاشلة
   */
  async ensureHierarchyAlert(guild: Guild): Promise<HierarchyStatus> {
    const status = this.checkHierarchy(guild);

    try {
      const known = this.hierarchyState.get(guild.id);

      // الحالة لم تتغيّر → لا نعيد التنبيه
      if (known !== undefined && known === status.ok) return status;

      // أول فحص على سيرفر سليم → نسجّل الحالة فقط **بدون أي رسالة**
      // (وإلا يُبلّغ البوت "تم الإصلاح" وهو لم يُصلَح شيء بعد)
      if (known === undefined && status.ok) {
        this.hierarchyState.set(guild.id, true);
        return status;
      }

      this.hierarchyState.set(guild.id, status.ok);

      // 🔕 صامت تماماً — لا رسائل تلقائية في السيرفر
      //    (الفحص اليدوي فقط عبر /protection hierarchy)
      if (status.ok) {
        logger.info(`✅ Hierarchy fixed in ${guild.name} — البوت الآن أعلى رتبة`);
      } else {
        logger.warn(
          `🚨 Hierarchy: bot NOT top in ${guild.name} | bot=#${status.botPosition} | offenders=${status.offenderCount}`
        );
      }
      return status;
    } catch (error: any) {
      logger.error(`ensureHierarchyAlert error: ${error.message}`);
    }

    return status;
  }

  // وايت ليست: الأونر + من معه Administrator + مطور البوت + القائمة البيضاء المخصصة = موثوق
  private async isWhitelisted(guild: Guild, executorId: string): Promise<boolean> {
    if (executorId === guild.ownerId) return true;
    // مطور البوت (DEVELOPER_USER_ID من .env) = وايت ليست في كل السيرفرات
    const devId = process.env.DEVELOPER_USER_ID;
    if (devId && executorId === devId) return true;
    const member = guild.members.cache.get(executorId);
    if (member?.permissions.has(PermissionFlagsBits.Administrator)) return true;

    // القائمة البيضاء المخصصة
    const settings = await getGuildSettings(guild.id);
    const wl = settings.protection?.whitelist;
    if (wl?.enabled && wl?.userIds?.includes(executorId)) return true;

    return false;
  }

  // 👑 المنفّذ الموثوق: المالك + مطوّر البوت + القائمة البيضاء المخصصة
  //    (حاملو Administrator ليسوا مستثنين — الحساب الإداري المخترق هو الأخطر!)
  //    يُستخدم لمنع البوت من مقاومة المالك أو معاقبة من تثق به
  private async isTrustedExecutor(guild: Guild, executorId: string): Promise<boolean> {
    if (executorId === guild.ownerId) return true;
    const devId = process.env.DEVELOPER_USER_ID;
    if (devId && executorId === devId) return true;
    try {
      const settings = await getGuildSettings(guild.id);
      const wl = settings.protection?.whitelist;
      if (wl?.enabled && Array.isArray(wl?.userIds) && wl.userIds.includes(executorId)) return true;
    } catch { /* تجاهل */ }
    return false;
  }

  // --------------------------------------------
  // 0) ANTI-CREATE: أي بوت ينشئ قناة/رول → يُحذف فوراً (ماعدا الأونر والإدارة)
  // --------------------------------------------
  async onChannelCreate(channel: any): Promise<void> {
    try {
      if (!channel?.guild) return;
      // 🚀 أسرع fetch: limit=1 فقط
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 1500) return; // نافذة أضيق = أسرع رد
      if (entry.executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(channel.guild, entry.executor.id)) return; // 👑 موثوق ينشئ بحرية

      const member = channel.guild.members.cache.get(entry.executor.id);

      // 🤖 بوت → حذف + حظر فوري (ما نستنىش)
      if (entry.executor.bot) {
        // إطلاق فوري — ما نأوايتهمش
        channel.delete('Security: bot cannot create channels').catch(() => {});
        member?.roles.set([], 'Security: bot created channel').catch(() => {});
        member?.ban({ reason: 'Security: bot created channel (anti-nuke)' }).catch(() => {});
        // التنبيه في الخلفية
        getGuildSettings(channel.guild.id).then(s => this.getAlertChannel(channel.guild, s))
          .then(a => a?.send({ content: `🚫 **بوت حاول إنشاء قناة:** ${entry.executor.tag} — تم الحذف والحظر` }).catch(() => {}));
        return;
      }

      // 🧑 إنسان → قناة واحدة = هجوم فوري (مفيش عتبة، مفيش تأخير)
      // 🔥 حذف القناة فوراً — البان/السحب في التوازي
      channel.delete('Security: rapid channel create').catch(() => {});
      member?.roles.set([], 'Security: rapid channel creation').catch(() => {});
      member?.ban({ reason: 'Security: rapid channel creation (anti-nuke)' }).catch(() => {});
      // تنبيه في الخلفية
      getGuildSettings(channel.guild.id).then(s => this.getAlertChannel(channel.guild, s))
        .then(a => a?.send({ content: `🚨 **هجوم — ${entry.executor.tag} أنشأ قناة!**\nتم الحذف + الحظر` }).catch(() => {}));

    } catch (error: any) {
      logger.error(`onChannelCreate error: ${error.message}`);
    }
  }

  async onRoleCreate(role: any): Promise<void> {
    try {
      if (!role?.guild || role.managed) return;
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 1500) return;
      if (entry.executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(role.guild, entry.executor.id)) return; // 👑 موثوق

      const member = role.guild.members.cache.get(entry.executor.id);

      if (entry.executor.bot) {
        role.delete('Security: bot cannot create roles').catch(() => {});
        member?.roles.set([], 'Security: bot created role').catch(() => {});
        member?.ban({ reason: 'Security: bot created role (anti-nuke)' }).catch(() => {});
        getGuildSettings(role.guild.id).then(s => this.getAlertChannel(role.guild, s))
          .then(a => a?.send({ content: `🚫 **بوت حاول إنشاء رول:** ${entry.executor.tag} — تم الحذف والحظر` }).catch(() => {}));
        return;
      }

      // 🧑 إنسان → رول واحد = هجوم فوري
      role.delete('Security: rapid role create').catch(() => {});
      member?.roles.set([], 'Security: rapid role creation').catch(() => {});
      member?.ban({ reason: 'Security: rapid role creation (anti-nuke)' }).catch(() => {});
      getGuildSettings(role.guild.id).then(s => this.getAlertChannel(role.guild, s))
        .then(a => a?.send({ content: `🚨 **هجوم — ${entry.executor.tag} أنشأ رول!**\nتم الحذف + الحظر` }).catch(() => {}));

    } catch (error: any) {
      logger.error(`onRoleCreate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 0b) ANTI-RENAME: تغيير اسم قناة → إرجاع فوري + عقوبة
  // --------------------------------------------
  async onChannelUpdate(oldChannel: any, newChannel: any): Promise<void> {
    try {
      if (!newChannel?.guild || oldChannel.name === newChannel.name) return;
      const logs = await newChannel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 1500) return;
      if (entry.executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(newChannel.guild, entry.executor.id)) return; // 👑 موثوق يغيّر بحرية
      
      const guild = newChannel.guild;
      const member = guild.members.cache.get(entry.executor.id);
      if (!member) return;

      // 📋 جلب الإعدادات
      const settings = await getGuildSettings(guild.id);
      const antiNuke = settings.protection?.antiNuke;
      if (!antiNuke?.enabled) return;

      // 🛡️ فحص التسلسل الهرمي — لو البوت مش أعلى رتبة، العقوبات تفشل
      const hierarchy = this.checkHierarchy(guild);
      if (!hierarchy.ok) {
        const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
        alert?.send({
          content: `⚠️ **فشل حماية إعادة التسمية** — البوت ليس أعلى رتبة!\n` +
            `المنفّذ: ${entry.executor.tag} | رول البوت: ${hierarchy.botRoleName} (#${hierarchy.botPosition})\n` +
            `رولات فوق البوت: ${hierarchy.offenderCount} — اسحب رول البوت للأعلى.`
        }).catch(() => {});
        logger.warn(`Hierarchy block: rename revert failed in ${guild.name} — bot not top role`);
        return;
      }

      // 🔐 فحص الصلاحيات
      const me = guild.members.me;
      const canManageChannels = me?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
      const canKick = me?.permissions.has(PermissionFlagsBits.KickMembers) ?? false;
      const canBan = me?.permissions.has(PermissionFlagsBits.BanMembers) ?? false;

      let nameRestored = false;
      let punished = false;
      let punishType = 'none';

      // 1️⃣ إرجاع الاسم
      if (canManageChannels) {
        try {
          await newChannel.setName(oldChannel.name, 'Security: rename reverted');
          nameRestored = true;
        } catch (e: any) {
          logger.warn(`Failed to restore channel name in ${guild.name}: ${e.message}`);
        }
      }

      // 2️⃣ العقوبة حسب إعدادات antiNuke
      const action = antiNuke.action || 'kick';
      if (action !== 'alert' && member) {
        if (action === 'strip' && canKick) {
          try {
            await member.roles.set([], 'Security: rapid rename (strip roles)');
            punished = true;
            punishType = 'strip';
          } catch (e: any) {
            logger.warn(`Failed to strip roles in ${guild.name}: ${e.message}`);
          }
        } else if (action === 'kick' && canKick) {
          try {
            await member.kick('Security: rapid channel rename');
            punished = true;
            punishType = 'kick';
          } catch (e: any) {
            logger.warn(`Failed to kick in ${guild.name}: ${e.message}`);
          }
        } else if (action === 'ban' && canBan) {
          try {
            await member.ban({ reason: 'Security: rapid channel rename (anti-nuke)' });
            punished = true;
            punishType = 'ban';
          } catch (e: any) {
            logger.warn(`Failed to ban in ${guild.name}: ${e.message}`);
          }
        }
      }

      // 3️⃣ إرسال التقرير
      const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
      const executorType = entry.executor.bot ? '🤖 بوت' : '👤 عضو';
      let msg = `✏️ **${executorType} غيّر اسم قناة:** ${entry.executor.tag}\n`;
      msg += `📝 القناة: <#${newChannel.id}>\n`;
      msg += `🔄 استرجاع الاسم: ${nameRestored ? '✅ تم' : canManageChannels ? '❌ فشل' : '⚠️ لا توجد صلاحية ManageChannels'}\n`;
      if (action === 'alert') {
        msg += `🔔 الإجراء: تنبيه فقط (حسب الإعدادات)`;
      } else {
        msg += `🛡️ العقوبة (${action}): ${punished ? `✅ ${punishType}` : '❌ فشل — تحقق من الصلاحيات/الهرمية'}`;
      }
      alert?.send({ content: msg }).catch(() => {});

    } catch (error: any) {
      logger.error(`onChannelUpdate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 0c) ANTI-PERMISSION: تعديل صلاحيات → إرجاع فوري + عقوبة
  // --------------------------------------------
  async cleanupSuspicious(guild: Guild): Promise<number> {
    let deleted = 0;
    const pattern = /nuked|hacked|kly|rcl|cracked|death.?note|pwned|owned|here|on.?top|spam|raid|destroy|test.?123/i;
    for (const [, ch] of guild.channels.cache) {
      if (pattern.test(ch.name)) {
        try { await ch.delete('Security: auto-cleanup suspicious channel'); deleted++; } catch {}
      }
    }
    for (const [, role] of guild.roles.cache) {
      if (role.id === guild.id || role.managed) continue;
      if (pattern.test(role.name)) {
        try { await role.delete('Security: auto-cleanup suspicious role'); deleted++; } catch {}
      }
    }
    if (deleted > 0) {
      const settings = await getGuildSettings(guild.id);
      const alert = await this.getAlertChannel(guild, settings);
      alert?.send({ content: `🧹 **تنظيف تلقائي:** تم حذف ${deleted} روم/رول مشبوه` }).catch(() => {});
    }
    return deleted;
  }

  // --------------------------------------------
  // Pro Max: ANTI-WEBHOOK SPAM — ويب هوك → حذف فوري + عقوبة
  // --------------------------------------------
  async onWebhookUpdate(webhook: any): Promise<void> {
    try {
      if (!webhook?.guild) return;
      const logs = await webhook.guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 1500) return;
      if (entry.executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(webhook.guild, entry.executor.id)) return; // 👑 موثوق

      const guild = webhook.guild;
      const member = guild.members.cache.get(entry.executor.id);
      if (!member) return;

      const settings = await getGuildSettings(guild.id);
      const antiNuke = settings.protection?.antiNuke;
      if (!antiNuke?.enabled) return;

      const hierarchy = this.checkHierarchy(guild);
      if (!hierarchy.ok) {
        const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
        alert?.send({ content: `⚠️ **فشل حماية الويب هوك** — البوت ليس أعلى رتبة! اسحب رول البوت للأعلى.` }).catch(() => {});
        return;
      }

      const me = guild.members.me;
      const canManageWebhooks = me?.permissions.has(PermissionFlagsBits.ManageWebhooks) ?? false;
      const canKick = me?.permissions.has(PermissionFlagsBits.KickMembers) ?? false;
      const canBan = me?.permissions.has(PermissionFlagsBits.BanMembers) ?? false;

      let deleted = false;
      let punished = false;
      let punishType = 'none';

      if (canManageWebhooks) {
        try { await webhook.delete('Security: webhook spam'); deleted = true; } catch {}
      }

      const action = antiNuke.action || 'kick';
      if (action !== 'alert' && member) {
        if (action === 'strip' && canKick) {
          try { await member.roles.set([], 'Security: webhook spam'); punished = true; punishType = 'strip'; } catch {}
        } else if (action === 'kick' && canKick) {
          try { await member.kick('Security: webhook spam'); punished = true; punishType = 'kick'; } catch {}
        } else if (action === 'ban' && canBan) {
          try { await member.ban({ reason: 'Security: webhook spam' }); punished = true; punishType = 'ban'; } catch {}
        }
      }

      const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
      const executorType = entry.executor.bot ? '🤖 بوت' : '👤 عضو';
      let msg = `🔗 **${executorType} أنشأ ويب هوك:** ${entry.executor.tag}\n`;
      msg += `🗑️ الحذف: ${deleted ? '✅' : canManageWebhooks ? '❌' : '⚠️ لا توجد صلاحية'}\n`;
      if (action === 'alert') msg += `🔔 الإجراء: تنبيه فقط`;
      else msg += `🛡️ العقوبة (${action}): ${punished ? `✅ ${punishType}` : '❌ فشل'}`;
      alert?.send({ content: msg }).catch(() => {});

    } catch (error: any) {
      logger.error(`onWebhookUpdate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Pro Max: ANTI-ROLE ASSIGNMENT — إعطاء رولات → إرجاع فوري + عقوبة
  // --------------------------------------------
  async onGuildMemberUpdate(oldMember: any, newMember: any): Promise<void> {
    try {
      if (!newMember?.guild) return;
      const addedRoles = newMember.roles.cache.filter((r: any) => !oldMember.roles.cache.has(r.id));
      if (addedRoles.size === 0) return;
      const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 1500) return;
      if (entry.executor.id === this.client.user?.id) return;
      const executorMember = newMember.guild.members.cache.get(entry.executor.id);

      const guild = newMember.guild;
      const settings = await getGuildSettings(guild.id);
      const antiNuke = settings.protection?.antiNuke;
      if (!antiNuke?.enabled) return;

      if (await this.isTrustedExecutor(guild, entry.executor.id)) return;

      const hierarchy = this.checkHierarchy(guild);
      if (!hierarchy.ok) {
        const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
        alert?.send({ content: `⚠️ **فشل حماية إعطاء الرولات** — البوت ليس أعلى رتبة! اسحب رول البوت للأعلى.` }).catch(() => {});
        return;
      }

      const me = guild.members.me;
      const canManageRoles = me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
      const canKick = me?.permissions.has(PermissionFlagsBits.KickMembers) ?? false;
      const canBan = me?.permissions.has(PermissionFlagsBits.BanMembers) ?? false;

      let rolesRestored = false;
      let punished = false;
      let punishType = 'none';

      if (canManageRoles) {
        try { await newMember.roles.remove(addedRoles, 'Security: unauthorized role assignment'); rolesRestored = true; } catch {}
      }

      const action = antiNuke.action || 'kick';
      if (action !== 'alert' && executorMember) {
        if (action === 'strip' && canKick) {
          try { await executorMember.roles.set([], 'Security: role assignment spam'); punished = true; punishType = 'strip'; } catch {}
        } else if (action === 'kick' && canKick) {
          try { await executorMember.kick('Security: role assignment spam'); punished = true; punishType = 'kick'; } catch {}
        } else if (action === 'ban' && canBan) {
          try { await executorMember.ban({ reason: 'Security: role assignment spam' }); punished = true; punishType = 'ban'; } catch {}
        }
      }

      const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
      const executorType = entry.executor.bot ? '🤖 بوت' : '👤 عضو';
      let msg = `🎭 **${executorType} أعطى رول:** ${entry.executor.tag}\n`;
      msg += `👤 الهدف: ${newMember.user.tag}\n`;
      msg += `🔄 استرجاع الرولات: ${rolesRestored ? '✅' : canManageRoles ? '❌' : '⚠️ لا توجد صلاحية ManageRoles'}\n`;
      if (action === 'alert') msg += `🔔 الإجراء: تنبيه فقط`;
      else msg += `🛡️ العقوبة (${action}): ${punished ? `✅ ${punishType}` : '❌ فشل'}`;
      alert?.send({ content: msg }).catch(() => {});

    } catch (error: any) {
      logger.error(`onGuildMemberUpdate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Pro Max: ANTI-PERMISSION OVERWRITE CHANGES — تعديل صلاحيات → إرجاع فوري + عقوبة
  // --------------------------------------------
  async onChannelPermissionUpdate(oldChannel: any, newChannel: any): Promise<void> {
    try {
      if (!newChannel?.guild) return;
      const oldOverwrites = oldChannel.permissionOverwrites?.cache?.size ?? 0;
      const newOverwrites = newChannel.permissionOverwrites?.cache?.size ?? 0;
      if (Math.abs(oldOverwrites - newOverwrites) < 1) return; // أي تغيير = رد
      const logs = await newChannel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 1500) return;
      if (entry.executor.id === this.client.user?.id) return;
      const member = newChannel.guild.members.cache.get(entry.executor.id);

      const guild = newChannel.guild;
      const settings = await getGuildSettings(guild.id);
      const antiNuke = settings.protection?.antiNuke;
      if (!antiNuke?.enabled) return;

      if (await this.isTrustedExecutor(guild, entry.executor.id)) return;

      const hierarchy = this.checkHierarchy(guild);
      if (!hierarchy.ok) {
        const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
        alert?.send({ content: `⚠️ **فشل حماية الصلاحيات** — البوت ليس أعلى رتبة! اسحب رول البوت للأعلى.` }).catch(() => {});
        return;
      }

      const me = guild.members.me;
      const canManageChannels = me?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
      const canKick = me?.permissions.has(PermissionFlagsBits.KickMembers) ?? false;
      const canBan = me?.permissions.has(PermissionFlagsBits.BanMembers) ?? false;

      let permsRestored = false;
      let punished = false;
      let punishType = 'none';

      if (canManageChannels) {
        try { await newChannel.permissionOverwrites.set(oldChannel.permissionOverwrites.cache.map((o: any) => [o.id, o]), 'Security: perm overwrite reverted'); permsRestored = true; } catch {}
      }

      const action = antiNuke.action || 'kick';
      if (action !== 'alert' && member) {
        if (action === 'strip' && canKick) {
          try { await member.roles.set([], 'Security: perm overwrite spam'); punished = true; punishType = 'strip'; } catch {}
        } else if (action === 'kick' && canKick) {
          try { await member.kick('Security: perm overwrite spam'); punished = true; punishType = 'kick'; } catch {}
        } else if (action === 'ban' && canBan) {
          try { await member.ban({ reason: 'Security: perm overwrite spam' }); punished = true; punishType = 'ban'; } catch {}
        }
      }

      const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
      const executorType = entry.executor.bot ? '🤖 بوت' : '👤 عضو';
      let msg = `🔐 **${executorType} غيّر صلاحيات قناة:** ${entry.executor.tag}\n`;
      msg += `📍 القناة: <#${newChannel.id}>\n`;
      msg += `🔄 استرجاع الصلاحيات: ${permsRestored ? '✅' : canManageChannels ? '❌' : '⚠️ لا توجد صلاحية ManageChannels'}\n`;
      if (action === 'alert') msg += `🔔 الإجراء: تنبيه فقط`;
      else msg += `🛡️ العقوبة (${action}): ${punished ? `✅ ${punishType}` : '❌ فشل'}`;
      alert?.send({ content: msg }).catch(() => {});

    } catch (error: any) {
      logger.error(`onChannelPermissionUpdate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Pro Max: STICKY BOT ROLE POSITION — كل 10 ثواني يتأكد إن رول البوت في القمة
  // --------------------------------------------
  public startStickyRoleWatchdog(guild: Guild): void {
    if (this.topWatchdogs?.has?.(guild.id)) return;
    const check = async () => {
      try {
        const me = guild.members.me;
        if (!me) return;
        const botRole = me.roles.highest;
        const rolesArray = Array.from(guild.roles.cache.values());
        const highestUserRole = rolesArray
          .filter(r => !r.managed && r.id !== guild.id)
          .sort((a, b) => b.position - a.position)[0];
        if (highestUserRole && botRole.position <= highestUserRole.position) {
          try {
            // 🔕 صامت تماماً — لا رسائل تلقائية، الرفع فقط
            //    (الحالة تُفحص يدوياً عبر /protection hierarchy)
            await botRole.setPosition(highestUserRole.position + 1, { reason: 'Security: sticky top position' });
          } catch {}
        }
      } catch {}
    };
    check();
    const timer = setInterval(check, 10000); // every 10 seconds
    if (!this.topWatchdogs) (this as any).topWatchdogs = new Map();
    this.topWatchdogs.set(guild.id, timer);
  }

  // --------------------------------------------
  // Pro Max: ANTI-EMOJI/STICKER DELETE SPAM
  // --------------------------------------------
  async onGuildEmojiDelete(emoji: any): Promise<void> {
    await this.handleMassDelete(emoji.guild, 'emoji', AuditLogEvent.EmojiDelete, emoji.id);
  }
  async onGuildStickerDelete(sticker: any): Promise<void> {
    await this.handleMassDelete(sticker.guild, 'sticker', AuditLogEvent.StickerDelete, sticker.id);
  }

  // --------------------------------------------
  // Pro Max: ANTI-MASS-MESSAGE-DELETE — كشف الحذف الجماعي للرسائل + استعادة فورية
  // --------------------------------------------
  async onMessageDeleteBulk(messages: any): Promise<void> {
    try {
      if (!messages?.size || !messages.first()?.guild) return;
      const guild = messages.first().guild;
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;

      const channel = messages.first().channel as any;
      if (!channel || channel.type !== 0) return; // فقط القنوات النصية

      // تتبّع الحذف الجماعي
      const tracker = this.getMessageDeletionTracker(guild.id);
      const now = Date.now();
      if (!tracker[channel.id]) tracker[channel.id] = [];
      tracker[channel.id].push(now);
      // نافذة 5 ثواني
      tracker[channel.id] = tracker[channel.id].filter(t => now - t <= 5000);

      const count = tracker[channel.id].length;
      const threshold = Math.max(cfg.threshold ?? 3, 10); // عتبة أعلى للرسائل (10+ رسالة في 5 ثواني)
      if (count < threshold) return;

      // تجاوز العتبة — هجوم حذف جماعي
      tracker[channel.id] = [];

      // معرفة المنفّذ
      const executor = await this.findExecutor(guild, 'MessageDeleteBulk' as any, channel.id);
      const isWhitelisted = executor ? await this.isWhitelisted(guild, executor.id) : false;

      // 🔒 قفل القناة فوراً لمنع المزيد من الحذف
      try {
        await channel.permissionOverwrites.edit(guild.id, { SendMessages: false, AddReactions: false }, 'Security: mass message delete detected').catch(() => {});
      } catch {}

      // استعادة الرسائل من اللقطة
      let restored = 0;
      const snapshot = this.getMessageSnapshot(guild.id, channel.id);
      if (snapshot && snapshot.messages.length > 0) {
        for (const msg of snapshot.messages.slice(-50)) { // آخر 50 رسالة
          try {
            if (msg.content || msg.attachments.length > 0 || msg.embeds.length > 0) {
              await channel.send({
                content: msg.content || '📎 مرفق/إمبد',
                files: msg.attachments.map((a: any) => ({ attachment: a.url, name: a.name })),
                embeds: msg.embeds,
              }).catch(() => {});
              restored++;
              await sleep(200);
            }
          } catch {}
        }
      }

      // عقوبة المنفّذ
      let actionText = '⚠️ تعذّر تحديد المنفّذ';
      if (executor) {
        actionText = await this.punish(
          guild,
          executor,
          cfg.action ?? 'ban',
          `Liberty City Anti-Nuke: حذف جماعي للرسائل (${messages.size} رسالة)`
        );
      }

      // تنبيه
      const embed = new EmbedBuilder()
        .setTitle('🚨 تحذير أمني — حذف جماعي للرسائل!')
        .setDescription(`تم حذف **${messages.size} رسالة** في ${channel} خلال ثوانٍ — تم قفل القناة واستعادة ما أمكن.`)
        .setColor(Colors.error)
        .addFields(
          { name: 'المخالف', value: executor ? `${executor} (\`${executor.tag}\`)${isWhitelisted ? ' 👑' : ''}` : 'غير معروف', inline: true },
          { name: 'الإجراء', value: actionText, inline: true },
          { name: '📬 استعادة', value: `أعيد إرسال **${restored}** رسالة`, inline: true },
          { name: '🛡️ مستوى تسلّم البوت', value: await this.hierarchyField(guild), inline: false },
        )
        .setFooter({ text: 'Liberty City Anti-Nuke' })
        .setTimestamp();

      const alert = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
      if (alert) {
        await alert.send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined }).catch(() => {});
      }

      logger.warn(`🚨 Anti-Nuke: Mass message delete in ${guild.name} (${channel.name}) | executor=${executor?.tag ?? 'unknown'}`);
    } catch (error: any) {
      logger.error(`onMessageDeleteBulk error: ${error.message}`);
    }
  }

  // لقطة رسائل دورية للاستعادة
  private messageSnapshotInterval: Map<string, NodeJS.Timeout> = new Map();

  public startMessageSnapshotter(guild: Guild): void {
    if (this.messageSnapshotInterval.has(guild.id)) return;
    const interval = setInterval(() => this.captureMessageSnapshots(guild), 30000); // كل 30 ثانية
    this.messageSnapshotInterval.set(guild.id, interval);
  }

  private async captureMessageSnapshots(guild: Guild): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;

      for (const [, channel] of guild.channels.cache) {
        if (channel.type !== 0) continue; // نصية فقط
        const me = guild.members.me;
        if (!me || !channel.permissionsFor(me)?.has('ReadMessageHistory')) continue;

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages?.size) continue;

        const snapshot: MessageSnapshot = {
          channelId: channel.id,
          messages: messages.map(m => ({
            id: m.id,
            content: m.content,
            authorId: m.author.id,
            authorTag: m.author.tag,
            attachments: m.attachments.map(a => ({ url: a.url, name: a.name })),
            embeds: m.embeds,
            timestamp: m.createdTimestamp,
          })).reverse(), // الأقدم أولاً
          at: Date.now(),
        };
        this.setMessageSnapshot(guild.id, channel.id, snapshot);
      }
    } catch (error: any) {
      logger.warn(`captureMessageSnapshots failed in ${guild.name}: ${error.message}`);
    }
  }

  private getMessageDeletionTracker(guildId: string): MessageDeletionTracker {
    let tracker = this.messageDeletionTracker.get(guildId);
    if (!tracker) {
      tracker = {};
      this.messageDeletionTracker.set(guildId, tracker);
    }
    return tracker;
  }

  private getMessageSnapshot(guildId: string, channelId: string): MessageSnapshot | null {
    const channels = this.messageSnapshots.get(guildId);
    if (!channels) return null;
    return channels.get(channelId) ?? null;
  }

  private setMessageSnapshot(guildId: string, channelId: string, snapshot: MessageSnapshot): void {
    let channels = this.messageSnapshots.get(guildId);
    if (!channels) {
      channels = new Map();
      this.messageSnapshots.set(guildId, channels);
    }
    channels.set(channelId, snapshot);
  }

  private async handleMassDelete(guild: Guild, type: 'channel' | 'role' | 'ban' | 'kick' | 'emoji' | 'sticker', auditType: AuditLogEvent, targetId: string): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;
      const count = this.track(guild.id, type, cfg.timeWindow ?? 10000);
      if (count < (cfg.threshold ?? 3)) return;
      this.deletionTracker.get(guild.id)![type as keyof DeletionTracker] = [];
      await this.respondMassDeletion(guild, settings, cfg, type as any, auditType, targetId);
    } catch (error: any) {
      logger.error(`handleMassDelete error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Pro Max: ANTI-THREAD CREATE SPAM (ماعدا الأونر)
  // --------------------------------------------
  async onThreadCreate(thread: any): Promise<void> {
    try {
      if (!thread?.guild) return;
      const logs = await thread.guild.fetchAuditLogs({ type: AuditLogEvent.ThreadCreate, limit: 5 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 3000) return;
      if (entry.executor.id === this.client.user?.id) return;
      // ⚠️ مفيش وايت ليست — أي بوت أو أداة تهكير
      if (!entry.executor.bot) return;
      const member = thread.guild.members.cache.get(entry.executor.id);
      try { await thread.delete('Security: bot cannot create threads'); } catch {}
      if (member) { try { await member.roles.set([], 'Security: bot created thread'); } catch {} }
      const settings = await getGuildSettings(thread.guild.id);
      const alert = await this.getAlertChannel(thread.guild, settings);
      alert?.send({ content: `🧵 **بوت حاول إنشاء ثريد:** ${entry.executor.tag} — تم الحذف وسحب الصلاحيات` }).catch(() => {});
    } catch (error: any) {
      logger.error(`onThreadCreate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 1) ANTI-NUKE: كشف الحذف الجماعي
  // --------------------------------------------
  async onChannelDelete(channel: any): Promise<void> {
    try {
      if (!channel?.guild) return;
      const settings = await getGuildSettings(channel.guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;

      const count = this.track(channel.guild.id, 'channel', cfg.timeWindow ?? 10000);
      // ⚡ استجابة فورية من أول حذف — "مايقدر اساسا يحذف قنوات" (العتبة القديمة3/10ث كانت تسمح بحذفين بلا رد)
      if (count < 1) return;

      this.deletionTracker.get(channel.guild.id)!.channel = [];
      await this.respondMassDeletion(channel.guild, settings, cfg, 'channel', AuditLogEvent.ChannelDelete, channel.id);
    } catch (error: any) {
      logger.error(`onChannelDelete error: ${error.message}`);
    }
  }

  async onRoleDelete(role: any): Promise<void> {
    try {
      if (!role?.guild || role.id === role.guild.id) return;
      const settings = await getGuildSettings(role.guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;

      const count = this.track(role.guild.id, 'role', cfg.timeWindow ?? 10000);
      // ⚡ استجابة فورية من أول حذف رول
      if (count < 1) return;

      this.deletionTracker.get(role.guild.id)!.role = [];
      await this.respondMassDeletion(role.guild, settings, cfg, 'role', AuditLogEvent.RoleDelete, role.id);
    } catch (error: any) {
      logger.error(`onRoleDelete error: ${error.message}`);
    }
  }

  async onBanAdd(ban: any): Promise<void> {
    try {
      if (!ban?.guild) return;
      const settings = await getGuildSettings(ban.guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;

      const count = this.track(ban.guild.id, 'ban', cfg.timeWindow ?? 10000);
      // ⚡ استجابة فورية من أول حظر — يُلغي حظر الضحية ويعاقب المنفّذ
      if (count < 1) return;

      this.deletionTracker.get(ban.guild.id)!.ban = [];
      await this.respondMassDeletion(ban.guild, settings, cfg, 'ban', AuditLogEvent.MemberBanAdd, ban.user?.id);
    } catch (error: any) {
      logger.error(`onBanAdd error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 1b) ANTI-KICK: رصد الطرد الجماعي + استعادة المطرودين
  // --------------------------------------------
  // 🔴 الثغرة التي حدثت فعلاً: مضاد النيوك كان يراقب القنوات والرولات والحظر
  //    **ولا يراقب الطرد إطلاقاً** → ٧٥ طرد في ثوانٍ = صفر استجابة.
  //
  // وديسكورد **ما فيها أمر "إلغاء طرد"** — المطرود يرجع بالرابط فقط،
  // فالمستعادة الوحيدة الممكنة هي إرسال رابط الدعوة للمطرودين.
  async onMemberKick(member: GuildMember): Promise<void> {
    try {
      if (!member?.guild || member.user.bot) return;

      const settings = await getGuildSettings(member.guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;

      // نميّز الطرد عن الاستقالة الطوعية عبر سجلات التدقيق
      const executor = await this.findKickExecutor(member.guild, member.id);
      if (!executor) return; // استقالة عادية → لا نتدخل

      // نحتفظ بالمطرود ليرسل له رابط الدعوة (استعادة تلقائية)
      const queue = this.kickedQueue.get(member.guild.id) ?? [];
      if (!queue.some(e => e.userId === member.id)) {
        queue.push({ userId: member.id, tag: member.user.tag, at: Date.now() });
        this.kickedQueue.set(member.guild.id, queue);
        this.scheduleKickedRecovery(member.guild, settings);
      }

      // تتبّع العتبة — استجابة فورية من أول طرد (لا عتبة)
      const count = this.track(member.guild.id, 'kick', cfg.timeWindow ?? 10000);
      if (count < 1) return;

      this.deletionTracker.get(member.guild.id)!.kick = [];
      await this.respondMassDeletion(
        member.guild,
        settings,
        cfg,
        'kick',
        AuditLogEvent.MemberKick,
        member.id
      );
    } catch (error: any) {
      logger.error(`onMemberKick error: ${error.message}`);
    }
  }

  // يبحث في سجلات التدقيق عن أمر طرد يستهدف هذا العضو → يعيد المنفّذ
  // (سجلات التدقيق تتأخر ثانية أو ثانيتين، فنحاول ٣ مرات)
  private async findKickExecutor(guild: Guild, targetId: string): Promise<User | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const executor = await this.findExecutor(guild, AuditLogEvent.MemberKick, targetId);
      if (executor) return executor;
      if (attempt < 2) await sleep(600);
    }
    return null;
  }

  // يجمّع عدة طرود في محاولة استعادة واحدة (مؤجّل ٦ ثوانٍ)
  private scheduleKickedRecovery(guild: Guild, settings: any): void {
    if (settings?.protection?.antiNuke?.autoDmRecovery === false) return;

    const existing = this.kickedTimers.get(guild.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.kickedTimers.delete(guild.id);
      this.flushKickedRecovery(guild).catch(() => {});
    }, 6000);
    this.kickedTimers.set(guild.id, timer);
  }

  // يرسل رابط الدعوة لكل المطرودين المجمّعين ثم يفرّغ القائمة
  private async flushKickedRecovery(guild: Guild): Promise<void> {
    const queue = this.kickedQueue.get(guild.id) ?? [];
    if (!queue.length) return;
    this.kickedQueue.set(guild.id, []);

    try {
      const settings = await getGuildSettings(guild.id);
      const invite = await this.getInviteLink(guild);
      if (!invite) {
        logger.warn(`👢 استعادة الطرد في ${guild.name}: لا يوجد رابط دعوة`);
        return;
      }

      let sent = 0;
      for (const e of queue) {
        if (await this.dmInvite(guild, e.userId, invite)) sent++;
        await sleep(1500);
      }

      const channel = await this.getAlertChannel(
        guild,
        settings,
        settings?.protection?.antiNuke?.logChannel
      );
      if (channel) {
        await channel
          .send({
            embeds: [
              new EmbedBuilder()
                .setTitle('👢 استعادة المطرودين — اكتملت')
                .setDescription(
                  `أُرسل رابط الدعوة إلى **${sent}/${queue.length}** عضو مطرود.\n` +
                    '**مهم:** ديسكورد ما فيها "إلغاء طرد" — المطرود **يرجع بنفسه** من الرابط.'
                )
                .setColor(sent > 0 ? Colors.success : Colors.warning)
                .addFields(
                  { name: '📨 وصلت الرسالة', value: `${sent}`, inline: true },
                  { name: '⛔ لم تصل', value: `${queue.length - sent}`, inline: true },
                  { name: '🔗 الرابط', value: invite, inline: false }
                )
                .setFooter({ text: 'Liberty City — Kick Recovery' })
                .setTimestamp(),
            ],
          })
          .catch(() => {});
      }

      logger.info(`👢 استعادة الطرد في ${guild.name}: ${sent}/${queue.length} رسالة`);
    } catch (error: any) {
      logger.error(`flushKickedRecovery error: ${error.message}`);
    }
  }

  /**
   * 👢 استعادة المطرودين يدوياً — يقرأ سجلات التدقيق ويرسل لكل مطرود رابط الدعوة
   * (للاستعادة بعد هجوم وقع بالفعل — لا يمكن إلغاء الطرد في ديسكورد)
   */
  async recoverKickedFromAudit(
    guild: Guild,
    limit: number
  ): Promise<{ total: number; sent: number; failed: number; invite: string | null }> {
    const invite = await this.getInviteLink(guild);
    if (!invite) return { total: 0, sent: 0, failed: 0, invite: null };

    // نقرأ سجلات التدقيق على دفعات حتى نغطّي `limit`
    const kickedIds: string[] = [];
    let before: string | undefined;

    while (kickedIds.length < limit) {
      let logs;
      try {
        logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberKick,
          limit: 100,
          ...(before ? { before } : {}),
        });
      } catch {
        break;
      }

      const entries = [...logs.entries.values()];
      if (!entries.length) break;

      for (const e of entries) {
        if (e.targetId && !kickedIds.includes(e.targetId)) kickedIds.push(e.targetId);
        if (kickedIds.length >= limit) break;
      }

      if (entries.length < 100) break;
      before = entries[entries.length - 1].id;
      await sleep(400);
    }

    let sent = 0;
    let failed = 0;
    for (const userId of kickedIds) {
      if (await this.dmInvite(guild, userId, invite)) sent++;
      else failed++;
      await sleep(1500);
    }

    return { total: kickedIds.length, sent, failed, invite };
  }

  /** يرسل رسالة خاصة برابط الدعوة — يعيد true لو وصلت */
  private async dmInvite(guild: Guild, userId: string, invite: string): Promise<boolean> {
    try {
      const user = await this.client.users.fetch(userId);
      if (user.bot) return false;
      await user.send(
        `👋 مرحباً ${user.username}\n` +
          `انتطردت من **${guild.name}** — غالباً بالخطأ.\n` +
          `تقدر ترجع الحين من هنا:\n${invite}`
      );
      return true;
    } catch {
      return false; // الخصوصية مغلقة أو الحساب غير موجود
    }
  }

  /** رابط دعوة دائم — يستخدم الموجود أو ينشئ واحداً جديداً */
  async getInviteLink(guild: Guild): Promise<string | null> {
    try {
      const existing = await guild.invites.fetch();
      const first = existing.first();
      if (first) return `https://discord.gg/${first.code}`;
    } catch {
      /* لا صلاحية أو لا توجد دعوات محفوظة */
    }

    try {
      const me = guild.members.me;
      const channel = guild.channels.cache.find(
        (c): c is TextChannel =>
          c.type === ChannelType.GuildText &&
          !!me &&
          !!c.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite)
      );
      if (!channel) return null;

      const inv = await channel.createInvite({
        maxAge: 0,
        maxUses: 0,
        unique: false,
        reason: 'Liberty City — استعادة الأعضاء المطرودين',
      });
      return `https://discord.gg/${inv.code}`;
    } catch (error: any) {
      logger.warn(`getInviteLink failed in ${guild.name}: ${error.message}`);
      return null;
    }
  }

  private async respondMassDeletion(
    guild: Guild,
    settings: any,
    cfg: {
      threshold: number;
      timeWindow: number;
      action: 'alert' | 'kick' | 'ban' | 'strip';
      autoRestore?: boolean;
    },
    type: 'channel' | 'role' | 'ban' | 'kick',
    auditType: AuditLogEvent,
    targetId?: string
  ): Promise<void> {
    const labels = {
      channel: { emoji: '📢', label: 'قنوات' },
      role: { emoji: '🎭', label: 'رولات' },
      ban: { emoji: '🔨', label: 'حظر جماعي' },
      kick: { emoji: '👢', label: 'طرد جماعي' },
    } as const;

    const executor = await this.findExecutor(guild, auditType, targetId);
    const windowSec = Math.round((cfg.timeWindow ?? 10000) / 1000);

    // ⏱ استجابة فورية — لكن صامتة لو المنفّذ هو البوت نفسه (إغلاق تذكرة/تنظيف داخلي ليس هجوماً)
    if (executor && executor.id === this.client.user?.id) {
      logger.info(`⏭️ Anti-Nuke: تخطّي — المنفّذ هو البوت نفسه (${type} في ${guild.name})`);
      return;
    }

    // 👑 ثقة: المالك + مطوّر البوت + القائمة البيضاء → لا عقوبة ولا استعادة (الباقي: رد فوري كامل)
    const trusted = executor ? await this.isTrustedExecutor(guild, executor.id) : false;

    // 🔨 الحظر يُلغى فوراً عن الضحية — "مايقدر اساسا يبندهم"
    if (type === 'ban' && targetId && executor && !trusted) {
      await guild.members
        .unban(targetId, 'Liberty City Anti-Nuke: إلغاء حظر الضحية تلقائياً')
        .catch(() => {});
    }

    let actionText: string;
    if (!executor) {
      actionText = '⚠️ تعذّر تحديد المنفّذ من سجلات التدقيق';
    } else if (trusted) {
      actionText = '⏭️ المنفّذ موثوق (مالك/مطوّر/وايت ليست) — لا عقوبة';
    } else {
      actionText = await this.punish(
        guild,
        executor,
        cfg.action ?? 'kick',
        `Liberty City Anti-Nuke: حذف فوري (${labels[type].label})`
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(`🚨 تحذير أمني — استجابة فورية`)
      .setDescription(
        `${labels[type].emoji} تنفيذ عملية **${labels[type].label}** — ردّ أمني **فوري من أول عملية** (نافذة الرصد ${windowSec}ث) — نمط هجوم "نيوك"!`
      )
      .setColor(Colors.error)
      .addFields(
        { name: 'المخالف', value: executor ? `${executor} (\`${executor.tag}\`)${trusted ? ' 👑' : ''}` : 'غير معروف', inline: true },
        { name: 'الإجراء المتخذ', value: actionText, inline: true },
        {
          name: '🛡️ مستوى تسلّم البوت',
          value: await this.hierarchyField(guild),
          inline: false,
        },
        {
          name: '♻️ التعافي',
          value:
            type === 'ban'
              ? '🔨 تم **إلغاء حظر الضحية** تلقائياً (إن أمكن)'
              : type === 'kick'
                ? '👢 سيتم إرسال **رابط الدعوة** للمطرودين تلقائياً (يرجعون بأنفسهم)'
                : trusted
                  ? '⏭️ المنفّذ موثوق — تم تخطّي الاستعادة'
                  : cfg.autoRestore === false
                    ? 'الاستعادة التلقائية **مطفأة** — استخدم `/backup restore` يدوياً لاستعادة البنية'
                    : '♻️ **جارية الآن:** استعادة فورية من آخر نسخة احتياطية…',
          inline: false,
        }
      )
      .setFooter({ text: 'Liberty City Anti-Nuke' })
      .setTimestamp();

    // ♻️ الاستعادة تبدأ فوراً — بالتوازي مع إرسال التنبيه (لا ننتظر شيئاً)
    //    الحظر يُلغى أعلاه · الطرد: رابط دعوة عبر scheduleKickedRecovery
    const restoreP: Promise<unknown> =
      (type === 'channel' || type === 'role') && cfg.autoRestore !== false && !trusted
        ? this.runAutoRestore(guild, settings, type).then(() =>
            // 🧹 تنظيف فوري: حذف أي روم/رول مشبوه بعد الهكر
            this.cleanupSuspicious(guild).catch(() => {})
          )
        : Promise.resolve();

    const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
    if (channel) {
      await channel.send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined }).catch(() => {});
    }

    logger.warn(
      `🚨 Anti-Nuke (فوري): ${type} في ${guild.name} | executor=${executor?.tag ?? 'unknown'} | ${actionText}`
    );

    await restoreP;
  }

  // سطر يوضّح إذا كان البوت قادرًا فعلاً على العقوبة
  private async hierarchyField(guild: Guild): Promise<string> {
    try {
      const s = this.checkHierarchy(guild);
      return s.ok
        ? `✅ البوت أعلى رتبة (${s.botRoleName}) — يقدر يعاقب أي أحد`
        : `⛔ **البوت ليس أعلى رتبة** — ${s.offenderCount} رول فوقه، العقوبات تفشل. اسحب رول البوت للأعلى!`;
    } catch {
      return '—';
    }
  }

  // ♻️ الاستعادة التلقائية — تعيد القنوات والرولات المفقودة من آخر نسخة احتياطية
  private async runAutoRestore(
    guild: Guild,
    settings: any,
    type: 'channel' | 'role'
  ): Promise<void> {
    const channel = await this.getAlertChannel(
      guild,
      settings,
      settings?.protection?.antiNuke?.logChannel
    );

    try {
      const result = await this.restoreBackup(guild);

      const nothing = result.channels === 0 && result.roles === 0;

      const embed = new EmbedBuilder()
        .setTitle(nothing ? '♻️ الاستعادة التلقائية — لا يوجد شيء ناقص' : '♻️ الاستعادة التلقائية اكتملت')
        .setDescription(
          nothing
            ? 'كل البنية المحفوظة موجودة أصلاً — لا حاجة لإعادة إنشاء شيء.'
            : 'أُعيدت بنية السيرفر من آخر نسخة احتياطية تلقائياً بعد هجوم الحذف المكثف.'
        )
        .setColor(nothing ? Colors.warning : Colors.success)
        .addFields(
          { name: '📢 قنوات', value: `+${result.channels}`, inline: true },
          { name: '🎭 رولات', value: `+${result.roles}`, inline: true },
          { name: '⏭️ مُتجاوَز', value: `${result.skipped}`, inline: true }
        )
        .setFooter({ text: 'Liberty City — Auto Restore' })
        .setTimestamp();

      if (channel) await channel.send({ embeds: [embed] }).catch(() => {});

      logger.info(
        `♻️ Auto-restore ${guild.name} (${type}): +${result.channels} قناة، +${result.roles} رولة`
      );
    } catch (error: any) {
      logger.warn(`Auto-restore failed in ${guild.name}: ${error.message}`);
      if (channel) {
        await channel
          .send({
            embeds: [
              new EmbedBuilder()
                .setTitle('⚠️ فشلت الاستعادة التلقائية')
                .setDescription(
                  `**السبب:** ${error.message}\nجرّب يدوياً: \`/backup restore\``
                )
                .setColor(Colors.warning)
                .setFooter({ text: 'Liberty City — Auto Restore' })
                .setTimestamp(),
            ],
          })
          .catch(() => {});
      }
    }
  }

  // --------------------------------------------
  // 2) ANTI-BOT: طرد بوت غير مصرح به
  // --------------------------------------------
  // يعيد true إذا تم طرد العضو (لتخطي الترحيب)
  async onMemberJoin(member: GuildMember): Promise<boolean> {
    try {
      if (!member.user.bot) return false;

      const settings = await getGuildSettings(member.guild.id);
      const cfg = settings.protection?.antiBot;
      if (!cfg?.enabled) return false;
      if (cfg.whitelist?.includes(member.user.id)) return false;

      await member.kick('Liberty City Anti-Bot — بوت غير مصرح به').catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle('🤖 تم طرد بوت غير مصرح به')
        .setDescription('انضم بوت جديد دون إذن — تم طرده تلقائياً بواسطة نظام Anti-Bot')
        .setColor(Colors.warning)
        .addFields(
          { name: 'البوت', value: `${member.user} (\`${member.user.tag}\`)`, inline: true },
          { name: 'المعرف', value: `\`${member.user.id}\``, inline: true },
          {
            name: 'إضافة استثناء',
            value: 'استخدم `/protection antibot add:البوت` للاستثناء الدائم',
            inline: false,
          }
        )
        .setFooter({ text: 'Liberty City Anti-Bot' })
        .setTimestamp();

      const channel = await this.getAlertChannel(member.guild, settings);
      if (channel) await channel.send({ embeds: [embed] }).catch(() => {});

      logger.warn(`🤖 Anti-Bot: kicked ${member.user.tag} from ${member.guild.name}`);
      return true;
    } catch (error: any) {
      logger.error(`onMemberJoin error: ${error.message}`);
      return false;
    }
  }

  // --------------------------------------------
  // 3) ANTI-ADMIN: منح صلاحية Administrator
  // --------------------------------------------

  // 🚨 تنبيه حرج: خُفّضت رتبة البوت ففقد أعلى رتبة
  private async announceBotDemotion(guild: Guild, oldRole: Role, newRole: Role): Promise<void> {
    // نُلغي كتم التنبيه ليعاد إطلاقه مع هذه الحالة
    this.hierarchyState.set(guild.id, false);

    try {
      const settings = await getGuildSettings(guild.id);
      const channel = await this.getAlertChannel(
        guild,
        settings,
        settings?.protection?.antiNuke?.logChannel
      );

      const executor = await this.findExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
      const s = this.checkHierarchy(guild);

      const embed = new EmbedBuilder()
        .setTitle('🚨🚨 خُفّضت رتبة البوت — الحماية معطّلة الآن!')
        .setDescription(
          '**هذا أكثر هجوم صامت ضد السيرفر.**\n' +
          `رتبة **${oldRole.name}** نزلت من \`#${oldRole.position}\` إلى \`#${newRole.position}\`، ` +
          'وبذلك **فقد البوت أعلى رتبة**: مضاد النيوك لن يطرد ولا يحظر، والاستعادة التلقائية قد تفشل — ' +
          'والهجوم التالي على السيرفر **سينجح بلا مقاومة**.'
        )
        .setColor(Colors.error)
        .addFields(
          {
            name: '🎯 المنفّذ',
            value: executor ? `${executor} (\`${executor.tag}\`)` : '⚠️ غير معروف — راجع سجل التدقيق',
            inline: true,
          },
          {
            name: '📌 حالة البوت الآن',
            value: `أعلى رتبة: **${s.botRoleName}** — الموقع \`#${s.botPosition}\``,
            inline: true,
          },
          {
            name: `⛔ الرولات فوق البوت (${s.offenderCount})`,
            value: s.offenders.join('\n') || '—',
            inline: false,
          },
          {
            name: '✅ أعدّها الآن (خطوتين)',
            value:
              '**1.** Server Settings ← Roles\n' +
              `**2.** اسحب رول البوت (‎${s.botRoleName}‎) **لأعلى القائمة** تحت @everyone مباشرة\n\n` +
              '_بعد التصحيح يرسل البوت رسالة تأكيد بأن الحماية رجعت تعمل._',
            inline: false,
          }
        )
        .setFooter({ text: 'Liberty City — Hierarchy Guard' })
        .setTimestamp();

      if (channel) {
        await channel.send({ embeds: [embed], content: `<@${guild.ownerId}>` }).catch(() => {});
      }

      logger.error(
        `🚨🚨 Bot demoted in ${guild.name}: #${oldRole.position} → #${newRole.position} | executor=${executor?.tag ?? 'unknown'}`
      );
    } catch (error: any) {
      logger.error(`announceBotDemotion error: ${error.message}`);
    }
  }

  async onRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
    try {
      if (!newRole.guild) return;

      // 🚨 أخطر هجوم صامت: خفض رتبة البوت — يعطّل كل الحماية دفعة واحدة
      const me = newRole.guild.members.me;
      if (
        me &&
        me.roles.cache.has(newRole.id) &&
        newRole.position < oldRole.position &&
        !this.checkHierarchy(newRole.guild).ok
      ) {
        await this.announceBotDemotion(newRole.guild, oldRole, newRole);
      }

      const gainedAdmin =
        !oldRole.permissions.has(PermissionFlagsBits.Administrator) &&
        newRole.permissions.has(PermissionFlagsBits.Administrator);
      if (!gainedAdmin) return;

      const guild = newRole.guild;
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiAdmin;
      if (!cfg?.enabled) return;

      const isEveryone = newRole.id === guild.id;
      const executor = await this.findExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
      if (!executor) return;
      if (executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(guild, executor.id)) return; // 👑 موثوق

      const executorMember = guild.members.cache.get(executor.id);
      if (!executorMember) return;

      // 🛡️ فحص التسلسل الهرمي
      const hierarchy = this.checkHierarchy(guild);
      if (!hierarchy.ok) {
        const alert = await this.getAlertChannel(guild, settings, cfg.logChannel);
        alert?.send({ content: `⚠️ **فشل Anti-Admin** — البوت ليس أعلى رتبة! لا يمكن استرجاع Administrator من ${isEveryone ? '@everyone' : newRole.name}. اسحب رول البوت للأعلى.` }).catch(() => {});
        return;
      }

      const botMember = guild.members.me;
      const canManageRoles = botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
      const canKick = botMember?.permissions.has(PermissionFlagsBits.KickMembers) ?? false;

      const action = cfg.action || 'alert'; // 'alert' | 'kick'
      let permRevoked = false;
      let punished = false;
      let punishType = 'none';

      // 1️⃣ استرجاع صلاحية Administrator فوراً
      if (canManageRoles) {
        try {
          const perms = newRole.permissions;
          perms.remove(PermissionFlagsBits.Administrator);
          await newRole.setPermissions(perms, 'Security: Administrator revoked (anti-admin)');
          permRevoked = true;
        } catch (e: any) {
          logger.warn(`Failed to revoke Administrator in ${guild.name}: ${e.message}`);
        }
      }

      // 2️⃣ العقوبة حسب الإعداد
      if (action === 'kick' && canKick && executorMember) {
        try {
          await executorMember.kick('Security: granted Administrator (anti-admin)');
          punished = true;
          punishType = 'kick';
        } catch (e: any) {
          logger.warn(`Failed to kick admin granter in ${guild.name}: ${e.message}`);
        }
      }

      // 3️⃣ إرسال التقرير
      const alert = await this.getAlertChannel(guild, settings, cfg.logChannel);
      const executorType = executor.bot ? '🤖 بوت' : '👤 عضو';
      let msg = `⚠️ **منح صلاحية Administrator ${isEveryone ? 'لـ @everyone' : `للرول ${newRole.name}`}**\n`;
      msg += `🎯 المنفّذ: ${executorType} ${executor.tag}\n`;
      msg += `🔄 استرجاع Administrator: ${permRevoked ? '✅ تم' : canManageRoles ? '❌ فشل' : '⚠️ لا توجد صلاحية ManageRoles'}\n`;
      if (action === 'alert') {
        msg += `🔔 الإجراء: تنبيه فقط (حسب إعدادات antiAdmin)`;
      } else {
        msg += `🛡️ العقوبة (${action}): ${punished ? `✅ ${punishType}` : '❌ فشل — تحقق من الصلاحيات/الهرمية'}`;
      }
      alert?.send({ content: msg }).catch(() => {});

      logger.warn(
        `⚠️ Anti-Admin: Administrator granted to ${isEveryone ? '@everyone' : newRole.name} in ${guild.name} | revoked=${permRevoked} | action=${action} | punished=${punished}`
      );
    } catch (error: any) {
      logger.error(`onRoleUpdate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 4) AUTO-BACKUP: نسخ احتياطي دوري + الاستعادة
  // --------------------------------------------
  // (Re)جدولة المؤقت — استدعها عند ready وعند تبديل التبديل
  async syncAutoBackup(guild: Guild, forceNow = false): Promise<void> {
    try {
      const existing = this.backupTimers.get(guild.id);
      if (existing) {
        clearInterval(existing);
        this.backupTimers.delete(guild.id);
      }

      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.autoBackup;
      if (!cfg?.enabled) return;

      const hours = Math.min(72, Math.max(1, cfg.interval ?? 6));
      const timer = setInterval(() => {
        this.createBackup(guild).catch(err => logger.error(`Scheduled backup failed (${guild.name}): ${err.message}`));
      }, hours * 3600 * 1000);
      this.backupTimers.set(guild.id, timer);

      // نسخة أولى فورية إذا لم توجد نسخ أصلاً
      const doc = await BackupConfig.findOne({ guildId: guild.id }).lean();
      if (forceNow || !doc?.backups?.length) {
        setTimeout(() => {
          this.createBackup(guild).catch(err => logger.error(`Initial backup failed (${guild.name}): ${err.message}`));
        }, 5000);
      }

      logger.info(`💾 Auto-backup scheduled: ${guild.name} (كل ${hours} ساعة)`);
    } catch (error: any) {
      logger.error(`syncAutoBackup error (${guild.name}): ${error.message}`);
    }
  }

  // --------------------------------------------
  // 4b) AUTO-SCAN: فحص دوري كل N ساعات — كشف هاكر وإصلاح تلقائي
  // --------------------------------------------
  // (Re)جدولة مؤقت الفحص — استدعها عند ready وعند تبديل المفتاح في الإعدادات
  async syncAutoScan(guild: Guild): Promise<void> {
    try {
      const existing = this.scanTimers.get(guild.id);
      if (existing) {
        clearInterval(existing);
        this.scanTimers.delete(guild.id);
      }

      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.autoScan;
      if (!cfg?.enabled) return;

      const hours = Math.min(72, Math.max(1, cfg.interval ?? 6));
      const timer = setInterval(() => {
        this.runPeriodicScan(guild).catch(err =>
          logger.error(`Periodic scan failed (${guild.name}): ${err.message}`)
        );
      }, hours * 3600 * 1000);
      this.scanTimers.set(guild.id, timer);

      logger.info(`🔍 Auto-scan scheduled: ${guild.name} (كل ${hours} ساعة)`);
    } catch (error: any) {
      logger.error(`syncAutoScan error (${guild.name}): ${error.message}`);
    }
  }

  // 🔍 تنفيذ الفحص الدوري — يمسح رومات/رولات الهاكر ويرجّع الناقص
  async runPeriodicScan(guild: Guild): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.autoScan;
      if (!cfg?.enabled) return;

      // 1️⃣ حذف أي روم/رول مشبوه (نمط الهاكر)
      const suspiciousDeleted = await this.cleanupSuspicious(guild);

      // 2️⃣ مقارنة بالآخر نسخة احتياطية — ناقص = مهجم
      const doc = await BackupConfig.findOne({ guildId: guild.id }).lean() as any;
      const backup = doc?.backups?.length ? doc.backups[doc.backups.length - 1] : null;
      if (!backup?.data) return; // مافيش نسخة → مافيش مقارنة

      const curChannels = new Set(
        Array.from(guild.channels.cache.values()).map((c: any) => `${c.name}:${c.type}`)
      );
      const curRoles = new Set(
        Array.from(guild.roles.cache.values()).map((r: any) => r.name)
      );

      const missingChannels = ((backup.data.channels || []) as any[]).filter(
        (cd: any) =>
          RESTORABLE_CHANNEL_TYPES.includes(cd.type) &&
          !cd.name?.includes('category-') &&
          !curChannels.has(`${cd.name}:${cd.type}`)
      );
      const missingRoles = ((backup.data.roles || []) as any[]).filter(
        (rd: any) => !curRoles.has(rd.name)
      );

      const clean = suspiciousDeleted === 0 && missingChannels.length === 0 && missingRoles.length === 0;

      // ✅ السيرفر سليم → صامت تماماً (مافيش رسائل)
      if (clean) {
        logger.info(`🔍 Periodic scan OK: ${guild.name} — لا تغييرات`);
        return;
      }

      // 3️⃣ فيه اختراق → استعادة كاملة من النسخة
      const result = await this.restoreBackup(guild);

      const channel = await this.getAlertChannel(
        guild,
        settings,
        settings?.protection?.antiNuke?.logChannel
      );
      if (channel) {
        await channel
          .send({
            content:
              `🔍 **فحص دوري (كل ${cfg.interval ?? 6} ساعات) — اكتُشف اختراق!**\n` +
              `🧹 مسحت **${suspiciousDeleted}** روم/رول هاك\n` +
              `♻️ رجّعت **${result.channels}** قناة و **${result.roles}** رول` +
              (result.skipped ? ` (تخطّيت ${result.skipped} موجود)` : ''),
          })
          .catch(() => {});
      }

      logger.warn(
        `🔍 Periodic scan ${guild.name}: suspicious=${suspiciousDeleted} restored=${result.channels}ch/${result.roles}ro`
      );
    } catch (error: any) {
      logger.error(`runPeriodicScan error (${guild.name}): ${error.message}`);
    }
  }

  // إنشاء نسخة احتياطية (بنية القنوات + الرولات)
  async createBackup(guild: Guild): Promise<{ channels: number; roles: number; size: number }> {
    // نمط المشبوه — لا يُحفظ في النسخة الاحتياطية
    const SUSPICIOUS = /nuked|hacked|kly|rcl|cracked|death.?note|pwned|owned|here|on.?top|spam|raid|destroy|test.?123|vxl.?hak/i;

    const channels = guild.channels.cache
      .filter(c => !c.isThread() && !SUSPICIOUS.test(c.name))
      .map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        position: 'position' in c ? (c as any).position : 0,
        topic: (c as any).topic ?? null,
        parentId: c.parentId ?? null,
        nsfw: (c as any).nsfw ?? false,
        rateLimitPerUser: (c as any).rateLimitPerUser ?? 0,
      }))
      .sort((a, b) => a.position - b.position);

    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id && !r.managed && !SUSPICIOUS.test(r.name))
      .sort((a, b) => b.position - a.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        permissions: r.permissions.bitfield.toString(),
        hoist: r.hoist,
        mentionable: r.mentionable,
        position: r.position,
      }));

    const data = {
      guildName: guild.name,
      memberCount: guild.memberCount,
      channels,
      roles,
    };
    const size = JSON.stringify(data).length;

    let doc = await BackupConfig.findOne({ guildId: guild.id });
    if (!doc) {
      doc = new BackupConfig({ guildId: guild.id, enabled: true, interval: 'daily' });
    }

    doc.backups.push({ date: new Date(), data, size });
    const keep = 5;
    while (doc.backups.length > keep) doc.backups.shift();
    doc.lastBackup = new Date();
    await doc.save();

    logger.info(
      `💾 Backup created for ${guild.name}: ${channels.length} channels, ${roles.length} roles (${(size / 1024).toFixed(1)} KB)`
    );

    return { channels: channels.length, roles: roles.length, size };
  }

  // استعادة البنية — يُعاد إنشاء القنوات/الرولات المفقودة فقط (غير هدام)
  // 🔒 مقفل تزامن: لو استعادة جارية على نفس السيرفر ننتظر نتيجتها بدل
  //    تشغيل استعادة ثانية — وإلا تُنشأ القنوات مكرّرة عند الهجوم المتسارع
  async restoreBackup(
    guild: Guild,
    backupIndex?: number
  ): Promise<{ channels: number; roles: number; skipped: number }> {
    const inflight = this.restoreLocks.get(guild.id);
    if (inflight) {
      logger.info(`♻️ استعادة جارية بالفعل في ${guild.name} — ننتظر نتيجتها`);
      return inflight;
    }

    const run = this.performRestore(guild, backupIndex).finally(() =>
      this.restoreLocks.delete(guild.id)
    );
    this.restoreLocks.set(guild.id, run);
    return run;
  }

  private async performRestore(
    guild: Guild,
    backupIndex?: number
  ): Promise<{ channels: number; roles: number; skipped: number }> {
    const doc = await BackupConfig.findOne({ guildId: guild.id });
    if (!doc?.backups?.length) throw new Error('لا توجد نسخ احتياطية — أنشئ واحدة أولاً بـ `/backup create`');

    const backup =
      backupIndex === undefined ? doc.backups[doc.backups.length - 1] : doc.backups[backupIndex];
    if (!backup) throw new Error('رقم النسخة غير صحيح — استخدم `/backup list`');

    const data: any = backup.data;
    const result = { channels: 0, roles: 0, skipped: 0 };
    const idMap: Record<string, string> = {};

    // نمط القنوات/الرولات المشبوهة — لا تُستعاد أبداً
    const SUSPICIOUS_PATTERN = /nuked|hacked|kly|rcl|cracked|death.?note|pwned|owned|here|on.?top|spam|raid|destroy|test.?123|vxl.?hak/i;

    // 1) الرولات أولاً — استراتيجية الصمت: لو اتحددنا نوقف تماماً 30 دقيقة
    let rateLimitStrikes = 0;
    for (const rd of data.roles || []) {
      if (SUSPICIOUS_PATTERN.test(rd.name)) { result.skipped++; continue; }
      const exists =
        guild.roles.cache.get(rd.id) ||
        guild.roles.cache.find(r => r.name === rd.name && r.id !== guild.id);
      if (exists) {
        result.skipped++;
        continue;
      }

      let attempts = 0;
      let created2 = false;
      while (!created2 && attempts < 10) {
        attempts++;
        try {
          const created = await guild.roles.create({
            name: rd.name,
            color: rd.color,
            permissions: BigInt(rd.permissions),
            hoist: !!rd.hoist,
            mentionable: !!rd.mentionable,
            reason: 'Liberty City — استعادة نسخة احتياطية',
          });
          idMap[`role:${rd.id}`] = created.id;
          result.roles++;
          created2 = true;
          rateLimitStrikes = 0; // reset strikes on success
        } catch (error: any) {
          const isRateLimit =
            error?.status === 429 ||
            error?.httpStatus === 429 ||
            /rate limit|too many/i.test(error?.message || '');
          if (isRateLimit) {
            rateLimitStrikes++;
            const retryAfter = error?.retry_after ?? error?.data?.retry_after ?? 60;
            if (rateLimitStrikes >= 2) {
              // محاولة ثالثة = صمت كامل 30 دقيقة
              logger.warn(`restore role "${rd.name}" — strike ${rateLimitStrikes}, full silence 30min`);
              await sleep(30 * 60 * 1000);
              rateLimitStrikes = 0;
            } else {
              const waitMs = Math.min((Number(retryAfter) || 60) * 1000 + 3000, 700000);
              logger.warn(`restore role "${rd.name}" — RL, waiting ${Math.round(waitMs / 1000)}s`);
              await sleep(waitMs);
            }
          } else {
            logger.warn(`restore role "${rd.name}" failed: ${error.message}`);
            result.skipped++;
            created2 = true;
          }
        }
      }
      if (!created2) result.skipped++;
      await sleep(700);
    }

    // 1.5) إعادة ترتيب الرولات حسب النسخة الاحتياطية
    if (result.roles > 0) {
      try {
        await sleep(2000);
        const curRoles = await guild.roles.fetch();
        const nameToId: Record<string, string> = {};
        for (const [, role] of curRoles) {
          if (role.managed || role.id === guild.id) continue;
          nameToId[role.name] = role.id;
        }

        // الترتيب: الأعلى position في النسخة = رقم position الأعلى في السيرفر
        const backupSorted = [...(data.roles || [])].sort(
          (a: any, b: any) => (b.position || 0) - (a.position || 0)
        );
        const positions: Array<{ role: string; position: number }> = [];
        let pos = backupSorted.length;
        for (const rd of backupSorted) {
          const id = nameToId[rd.name];
          if (id) {
            positions.push({ role: id, position: pos });
            pos--;
          }
        }

        if (positions.length > 1) {
          await guild.roles.setPositions(positions);
          logger.info(`📐 Reordered ${positions.length} roles to match backup`);
        }
      } catch (error: any) {
        logger.warn(`Role reorder failed: ${error.message}`);
      }
    }

    // 2) القنوات (الفئات أولاً ثم حسب الترتيب)
    const sortedChannels = [...(data.channels || [])].sort((a: any, b: any) => {
      const aCat = a.type === ChannelType.GuildCategory ? 0 : 1;
      const bCat = b.type === ChannelType.GuildCategory ? 0 : 1;
      if (aCat !== bCat) return aCat - bCat;
      return (a.position || 0) - (b.position || 0);
    });

    for (const cd of sortedChannels) {
      if (!RESTORABLE_CHANNEL_TYPES.includes(cd.type)) continue;
      if (SUSPICIOUS_PATTERN.test(cd.name)) { result.skipped++; continue; }

      const exists =
        guild.channels.cache.get(cd.id) ||
        guild.channels.cache.find(c => c.name === cd.name && c.type === cd.type);
      if (exists) {
        result.skipped++;
        continue;
      }

      try {
        const parentId = cd.parentId
          ? idMap[`ch:${cd.parentId}`] || guild.channels.cache.get(cd.parentId)?.id
          : undefined;

        const created = await guild.channels.create({
          name: cd.name,
          type: cd.type,
          ...(cd.topic ? { topic: cd.topic } : {}),
          ...(cd.nsfw ? { nsfw: true } : {}),
          ...(parentId ? { parent: parentId } : {}),
          reason: 'Liberty City — استعادة نسخة احتياطية',
        });
        idMap[`ch:${cd.id}`] = created.id;
        result.channels++;

        if (typeof cd.position === 'number' && cd.position > 0) {
          await created.setPosition(cd.position).catch(() => {});
        }
      } catch (error: any) {
        logger.warn(`restore channel "${cd.name}" failed: ${error.message}`);
        result.skipped++;
      }
      await sleep(700);
    }

    logger.info(
      `🔓 Restore for ${guild.name}: +${result.channels} channels, +${result.roles} roles, skipped ${result.skipped}`
    );

    return result;
  }

  // عرض النسخ المحفوظة
  async listBackups(guildId: string): Promise<Array<{ index: number; date: Date; size: number; channels: number; roles: number }>> {
    const doc = await BackupConfig.findOne({ guildId });
    if (!doc?.backups?.length) return [];

    return doc.backups.map((b, i) => ({
      index: i + 1,
      date: b.date,
      size: b.size || 0,
      channels: b.data?.channels?.length ?? 0,
      roles: b.data?.roles?.length ?? 0,
    }));
  }
}
