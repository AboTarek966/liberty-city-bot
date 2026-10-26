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

  // 💣 Nuke detection tracker
  private nukeTracker: Map<string, { channels: number; roles: number; webhooks: number; lastAction: number }> = new Map();

  // ⚡ بثّ سجلات التدقيق الفوري من Gateway — يحدّد المنفّذ بدون أي طلب REST
  //    (أسرع طريق ممكن: السجل يصل مع الحدث نفسه تقريباً)
  private auditStream: Map<string, any[]> = new Map();

  // 🎯 آثار المهاجم: قنوات/رولات/ويب هوكس أنشأها → تُحذف كلها بعد الحادث
  private attackerArtifacts: Map<string, {
    channels: Set<string>;
    roles: Set<string>;
    webhooks: Set<string>;
    at: number;
  }> = new Map();

  // 🚨 حادث نشط: يظل يمنع أي إنشاء جديد من المهاجم لمدة دقيقتين
  private activeIncidents: Map<string, { attackerId: string; expires: number }> = new Map();

  // 📈 معدل رسائل الويب هوك/البوتات (key → timestamps)
  private messageRate: Map<string, number[]> = new Map();

  // 📈 معدل إنشاء القنوات/الرولات لكل منفّذ (key → timestamps)
  private createTracker: Map<string, number[]> = new Map();

  // 🧹 منع تكرار معالجة نفس الهدف/المنفّذ خلال ثوانٍ
  private handledTargets: Map<string, number> = new Map();

  // 🤖 حارس البوتات الخطرة (يفحص البوتات الموجودة كل 30 ثانية)
  private botGuardTimers: Map<string, NodeJS.Timeout> = new Map();

  // ⚡ منع تكرار عقوبة نفس الحساب خلال دقيقة (تفادي أخطاء "محظور مسبقاً" وتوفير REST)
  private recentBans: Map<string, number> = new Map();
  private recentKicks: Map<string, number> = new Map();

  constructor(client: Client) {
    this.client = client;
    // تنظيف دوري كل 5 دقائق لمنع تسرب الذاكرة
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
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
    this.nukeTracker.delete(guildId);
    this.auditStream.delete(guildId);
    for (const key of this.attackerArtifacts.keys()) if (key.startsWith(`${guildId}:`)) this.attackerArtifacts.delete(key);
    this.activeIncidents.delete(guildId);
    this.hierarchyState.delete(guildId);
    const guard = this.botGuardTimers.get(guildId);
    if (guard) {
      clearInterval(guard);
      this.botGuardTimers.delete(guildId);
    }
    // معدلات الرسائل/الإنشاء الخاصة بالسيرفر
    for (const key of this.messageRate.keys()) if (key.startsWith(`${guildId}:`)) this.messageRate.delete(key);
    for (const key of this.createTracker.keys()) if (key.startsWith(`${guildId}:`)) this.createTracker.delete(key);
    for (const key of this.handledTargets.keys()) if (key.startsWith(`${guildId}:`)) this.handledTargets.delete(key);
    for (const key of this.recentBans.keys()) if (key.startsWith(`${guildId}:`)) this.recentBans.delete(key);
    for (const key of this.recentKicks.keys()) if (key.startsWith(`${guildId}:`)) this.recentKicks.delete(key);
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
    // Cleanup nuke tracker (older than 1 minute)
    const now = Date.now();
    for (const [guildId, tracker] of this.nukeTracker) {
      if (now - tracker.lastAction > 60000) {
        this.nukeTracker.delete(guildId);
      }
    }
    // Cleanup audit log cache (older than 10 seconds)
    for (const [key, val] of this.auditLogCache) {
      if (now - val.at > 10000) this.auditLogCache.delete(key);
    }
    // Cleanup rate trackers / incidents / artifacts / handled targets
    for (const [key, arr] of this.messageRate) {
      const fresh = arr.filter(t => now - t <= 15000);
      if (fresh.length) this.messageRate.set(key, fresh);
      else this.messageRate.delete(key);
    }
    for (const [key, arr] of this.createTracker) {
      const fresh = arr.filter(t => now - t <= 15000);
      if (fresh.length) this.createTracker.set(key, fresh);
      else this.createTracker.delete(key);
    }
    for (const [key, at] of this.handledTargets) {
      if (now - at > 30000) this.handledTargets.delete(key);
    }
    for (const [key, at] of this.recentBans) {
      if (now - at > 60000) this.recentBans.delete(key);
    }
    for (const [key, at] of this.recentKicks) {
      if (now - at > 60000) this.recentKicks.delete(key);
    }
    for (const [guildId, inc] of this.activeIncidents) {
      if (now > inc.expires) this.activeIncidents.delete(guildId);
    }
    for (const [guildId, art] of this.attackerArtifacts) {
      if (now - art.at > 30 * 60 * 1000) this.attackerArtifacts.delete(guildId);
    }
    for (const [guildId, arr] of this.auditStream) {
      const fresh = arr.filter(e => now - (e.createdTimestamp ?? 0) < 20000);
      if (fresh.length) this.auditStream.set(guildId, fresh);
      else this.auditStream.delete(guildId);
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

  // ⚡ كاش سجلات التدقيق — 2 ثوانٍ TTL (احتياطي فقط، البثّ الفوري يسبقه)
  private auditLogCache = new Map<string, { at: number; entries: any[] }>();

  // ثابت: بوتات ديسكورد الرسمية المسموح بها دائماً
  private static readonly TRUSTED_BOT_IDS = [
    '854233015475109888', // Clyde (Discord)
    '293036868578279425', // Discord Bots
  ];

  /** يستقبل سجل التدقيق لحظة وصوله من Gateway (بدون REST) */
  ingestAuditEntry(entry: any, guildId?: string): void {
    try {
      const gid = guildId || entry?.guild?.id || entry?.guildId;
      if (!gid || entry?.action === undefined) return;
      const arr = this.auditStream.get(gid) || [];
      arr.unshift(entry);
      const cutoff = Date.now() - 20000;
      while (arr.length > 250 || (arr.length > 0 && (arr[arr.length - 1]?.createdTimestamp ?? 0) < cutoff)) {
        arr.pop();
      }
      this.auditStream.set(gid, arr);
    } catch {
      /* لا تعطّل الأمان */
    }
  }

  private async getCachedAuditLogs(guild: Guild, type: AuditLogEvent, limit = 5): Promise<any[]> {
    const key = `${guild.id}:${type}`;
    const hit = this.auditLogCache.get(key);
    if (hit && Date.now() - hit.at < 2000) return hit.entries;
    const logs = await guild.fetchAuditLogs({ type, limit });
    const entries = [...logs.entries];
    this.auditLogCache.set(key, { at: Date.now(), entries });
    return entries;
  }

  // تحديد المنفّذ — أولاً من بثّ Gateway (فوري)، ثم REST كاحتياطي
  private async findExecutor(guild: Guild, type: AuditLogEvent, targetId?: string): Promise<User | null> {
    const now = Date.now();
    const streamed = (this.auditStream.get(guild.id) || []).filter(
      e => e.action === type && now - (e.createdTimestamp ?? now) < 20000
    );
    let entry = targetId ? streamed.find(e => e.targetId === targetId) : undefined;
    if (!entry) entry = streamed[0];
    if (entry?.executor) return entry.executor as User;

    try {
      const entries = await this.getCachedAuditLogs(guild, type, 5);
      const recent = entries.filter(e => now - (e.createdTimestamp ?? now) < 20000);
      // لو الهدف غير مطابق (تأخّر السجل) نأخذ أحدث سجل حديث — التعافي أهم من التطابق الدقيق
      const found = (targetId ? recent.find(e => e.targetId === targetId) : undefined) ?? recent[0];
      return found?.executor ? (found.executor as User) : null;
    } catch (error: any) {
      logger.warn(`fetchAuditLogs failed in ${guild.name}: ${error.message}`);
      return null;
    }
  }

  // يبحث في سجلات التدقيق عن أمر طرد يستهدف هذا العضو — بثّ فوري + 3 محاولات سريعة
  private async findKickExecutor(guild: Guild, targetId: string): Promise<User | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const executor = await this.findExecutor(guild, AuditLogEvent.MemberKick, targetId);
      if (executor) return executor;
      if (attempt < 2) await sleep(150);
    }
    return null;
  }

  // يبحث في سجلات التدقيق عن منفّذ أنشأ هدفاً محدداً — بدون شرط الحداثة (للويب هوك)
  private async findAuditCreator(guild: Guild, type: AuditLogEvent, targetId: string): Promise<User | null> {
    const now = Date.now();
    const streamed = (this.auditStream.get(guild.id) || []).find(
      e => e.action === type && e.targetId === targetId
    );
    if (streamed?.executor) return streamed.executor as User;
    try {
      const logs = await guild.fetchAuditLogs({ type, limit: 50 });
      const found = [...logs.entries.values()].find((e: any) => e.targetId === targetId);
      if (found && now - (found.createdTimestamp ?? now) < 24 * 60 * 60 * 1000 && found.executor) {
        return found.executor as User;
      }
      return null;
    } catch {
      return null;
    }
  }

  // --------------------------------------------
  // 🎯 أدوات الاستجابة الفورية
  // --------------------------------------------

  private recordArtifact(
    guildId: string,
    userId: string,
    kind: 'channels' | 'roles' | 'webhooks',
    id: string
  ): void {
    const key = `${guildId}:${userId}`;
    const cur = this.attackerArtifacts.get(key) || {
      channels: new Set<string>(),
      roles: new Set<string>(),
      webhooks: new Set<string>(),
      at: Date.now(),
    };
    cur.at = Date.now();
    cur[kind].add(id);
    this.attackerArtifacts.set(key, cur);
  }

  private startIncident(guildId: string, attackerId: string): void {
    this.activeIncidents.set(guildId, { attackerId, expires: Date.now() + 2 * 60 * 1000 });
  }

  private isActiveAttacker(guildId: string, userId: string): boolean {
    const inc = this.activeIncidents.get(guildId);
    return !!inc && Date.now() < inc.expires && inc.attackerId === userId;
  }

  private markHandled(key: string): boolean {
    const now = Date.now();
    if (now - (this.handledTargets.get(key) || 0) < 5000) return true;
    this.handledTargets.set(key, now);
    return false;
  }

  private botWhitelist(settings: any): Set<string> {
    const wl = new Set<string>();
    if (this.client.user?.id) wl.add(this.client.user.id);
    for (const id of SecurityHandler.TRUSTED_BOT_IDS) wl.add(id);
    for (const id of settings?.protection?.antiBot?.whitelist || []) wl.add(String(id));
    return wl;
  }

  // ⚡ حظر/طرد بالمعرّف مباشرة — لا ننتظر جلب العضو (جلب الأعضاء هو أبطأ خطوة)
  private async banUserById(guild: Guild, userId: string, reason: string): Promise<boolean> {
    if (!userId || userId === guild.ownerId || userId === this.client.user?.id) return false;
    const banKey = `${guild.id}:${userId}`;
    const lastBan = this.recentBans.get(banKey);
    if (lastBan && Date.now() - lastBan < 60000) return true; // محظور بالفعل الآن
    try {
      await guild.bans.create(userId, { reason });
      this.recentBans.set(banKey, Date.now());
      return true;
    } catch (error: any) {
      // احتياطي: طرد بالمعرّف
      try {
        await guild.members.kick(userId, reason);
        this.recentKicks.set(banKey, Date.now());
        return true;
      } catch (kickError: any) {
        logger.warn(`ban/kick by id failed in ${guild.name} (${userId}): ${error.message} / ${kickError.message}`);
        return false;
      }
    }
  }

  // عقوبة سريعة بالمعرّف (ban/kick) أو سحب رولات (strip)
  private async punishById(
    guild: Guild,
    executor: User,
    action: 'alert' | 'kick' | 'ban' | 'strip',
    reason: string
  ): Promise<string> {
    if (executor.id === guild.ownerId) return '⏭️ المالك مستثنى';
    if (executor.id === this.client.user?.id) return '⏭️ البوت مستثنى';
    const devId = process.env.DEVELOPER_USER_ID;
    if (devId && executor.id === devId) return '⏭️ مطوّر البوت مستثنى';

    if (action === 'alert') return '🔔 تنبيه فقط';

    if (action === 'ban') {
      const ok = await this.banUserById(guild, executor.id, reason);
      return ok ? '🔨 تم حظر المخالف فوراً' : '⚠️ فشل الحظر — تأكد أن رول البوت أعلى من رول المخالف';
    }

    if (action === 'kick') {
      const kickKey = `${guild.id}:${executor.id}`;
      const lastKick = this.recentKicks.get(kickKey);
      if (lastKick && Date.now() - lastKick < 60000) return '👢 تم طرد المخالف فوراً';
      try {
        await guild.members.kick(executor.id, reason);
        this.recentKicks.set(kickKey, Date.now());
        return '👢 تم طرد المخالف فوراً';
      } catch (error: any) {
        return `⚠️ فشل الطرد (${error.message}) — راجع تسلّم البوت`;
      }
    }

    // strip
    const member =
      guild.members.cache.get(executor.id) ||
      (await guild.members.fetch(executor.id).catch(() => null));
    if (!member) return '⚠️ المخالف لم يعد عضواً';
    try {
      await member.roles.set([], reason);
      return '🗡️ تم سلب كل الرولات فوراً';
    } catch (error: any) {
      return `⚠️ فشل سحب الرولات (${error.message})`;
    }
  }

  /**
   * 🧹 حذف كل ما أنشأه المهاجم (قنوات/رولات/ويب هوكس).
   * يعمل من الذاكرة أولاً ثم من سجلات التدقيق بفلتر user_id — حتى لو فاتتنا الأحداث.
   */
  private async purgeAttackerArtifacts(guild: Guild, attackerId: string, scheduleRetry = true): Promise<number> {
    let deleted = 0;
    const artKey = `${guild.id}:${attackerId}`;
    const art = this.attackerArtifacts.get(artKey);
    const cutoff = Date.now() - 10 * 60 * 1000;
    /** معرّفات آثار المهاجم — تُزال أيضاً من النسخ الاحتياطية حتى لا تعود بالاستعادة */
    const purgedChannels = new Set<string>();
    const purgedRoles = new Set<string>();

    const deleteChannel = async (id: string) => {
      if (!id) return;
      purgedChannels.add(String(id));
      const ch = guild.channels.cache.get(id);
      if (!ch) return;
      try {
        await ch.delete('Liberty City — حذف قناة أنشأها المهاجم');
        deleted++;
      } catch {}
    };
    const deleteRole = async (id: string) => {
      if (!id) return;
      purgedRoles.add(String(id));
      const role = guild.roles.cache.get(id);
      if (!role || role.id === guild.id || role.managed) return;
      try {
        await role.delete('Liberty City — حذف رول أنشأه المهاجم');
        deleted++;
      } catch {}
    };
    const deleteWebhooks = async (ids: Set<string>) => {
      if (!ids.size) return;
      try {
        const whs = await guild.fetchWebhooks();
        const tasks: Promise<unknown>[] = [];
        for (const [, wh] of whs) {
          if (!ids.has(wh.id)) continue;
          tasks.push(
            wh.delete('Liberty City — حذف ويب هوك أنشأه المهاجم')
              .then(() => { deleted++; })
              .catch(() => {})
          );
        }
        await Promise.allSettled(tasks);
      } catch {}
    };

    // 1) من الذاكرة (أسرع)
    if (art) {
      await Promise.allSettled([...art.channels].map(deleteChannel));
      await Promise.allSettled([...art.roles].map(deleteRole));
      await deleteWebhooks(art.webhooks);
    }

    // 2) من سجلات التدقيق — بالمنفّذ نفسه
    try {
      const [chLogs, roleLogs, whLogs] = await Promise.allSettled([
        guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, user: attackerId, limit: 50 }),
        guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, user: attackerId, limit: 50 }),
        guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, user: attackerId, limit: 50 }),
      ]);
      if (chLogs.status === 'fulfilled') {
        const ids = [...chLogs.value.entries.values()]
          .filter((e: any) => (e.createdTimestamp ?? 0) >= cutoff && e.targetId)
          .map((e: any) => e.targetId as string);
        await Promise.allSettled(ids.map(deleteChannel));
      }
      if (roleLogs.status === 'fulfilled') {
        const ids = [...roleLogs.value.entries.values()]
          .filter((e: any) => (e.createdTimestamp ?? 0) >= cutoff && e.targetId)
          .map((e: any) => e.targetId as string);
        await Promise.allSettled(ids.map(deleteRole));
      }
      if (whLogs.status === 'fulfilled') {
        const ids = new Set<string>(
          [...whLogs.value.entries.values()]
            .filter((e: any) => (e.createdTimestamp ?? 0) >= cutoff && e.targetId)
            .map((e: any) => e.targetId as string)
        );
        await deleteWebhooks(ids);
      }
    } catch {}

    if (art) {
      art.channels.clear();
      art.roles.clear();
      art.webhooks.clear();
    }

    // 3) 🧼 إزالة آثار المهاجم من النسخ الاحتياطية — حتى لا تعيدها الاستعادة التلقائية
    if (purgedChannels.size || purgedRoles.size) {
      try {
        const doc = await BackupConfig.findOne({ guildId: guild.id });
        if (doc?.backups?.length) {
          let changed = false;
          for (const b of doc.backups as any[]) {
            const data = b?.data;
            if (!data) continue;
            if (Array.isArray(data.channels) && purgedChannels.size) {
              const next = data.channels.filter((c: any) => !purgedChannels.has(String(c?.id)));
              if (next.length !== data.channels.length) {
                data.channels = next;
                changed = true;
              }
            }
            if (Array.isArray(data.roles) && purgedRoles.size) {
              const next = data.roles.filter((r: any) => !purgedRoles.has(String(r?.id)));
              if (next.length !== data.roles.length) {
                data.roles = next;
                changed = true;
              }
            }
          }
          if (changed) {
            doc.markModified('backups');
            await doc.save();
          }
        }
      } catch { /* النسخ الاحتياطية ليست حرجة */ }
    }

    // بعض الأحداث تصل بعد ثوانٍ — جولة ثانية خاطفة
    if (scheduleRetry) {
      setTimeout(() => {
        this.purgeAttackerArtifacts(guild, attackerId, false).catch(() => {});
      }, 2500).unref?.();
    }

    return deleted;
  }

  /** بوت غير مصرح قام بفعل خطير → حظر فوري + حذف ما أنشأه + حادث نشط */
  private async handleRogueBot(
    guild: Guild,
    executor: User,
    kind: 'channel' | 'role' | 'webhook',
    targetId?: string
  ): Promise<boolean> {
    try {
      if (executor.id === this.client.user?.id) return false;
      const key = `${guild.id}:rogue:${executor.id}`;
      if (this.markHandled(key)) return true;

      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      // البوتات تُمنع دائماً عندما يكون مضاد النيوك مفعّلاً (وضع المنع أو التفاعل)
      if (!cfg?.enabled) return false;
      if (await this.isTrustedExecutor(guild, executor.id)) return false;

      this.startIncident(guild.id, executor.id);

      // احذف الهدف فوراً قبل أي شيء
      if (targetId) {
        if (kind === 'channel') {
          this.recordArtifact(guild.id, executor.id, 'channels', targetId);
          guild.channels.cache.get(targetId)?.delete('Liberty City — بوت غير مصرح').catch(() => {});
        } else if (kind === 'role') {
          this.recordArtifact(guild.id, executor.id, 'roles', targetId);
          const role = guild.roles.cache.get(targetId);
          if (role && role.id !== guild.id && !role.managed) role.delete('Liberty City — بوت غير مصرح').catch(() => {});
        } else if (kind === 'webhook') {
          this.recordArtifact(guild.id, executor.id, 'webhooks', targetId);
        }
      }

      // حظر فوري بالمعرّف (لا ننتظر جلب العضو)
      const banned = await this.banUserById(
        guild,
        executor.id,
        'Liberty City — بوت غير مصرح قام بعملية تخريب (Anti-Nuke)'
      );

      // حذف كل آثاره
      const purged = await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);

      // تنبيه في الخلفية — لا يعطّل الاستجابة
      void getGuildSettings(guild.id)
        .then(s => this.getAlertChannel(guild, s, cfg.logChannel))
        .then(ch =>
          ch
            ?.send({
              content:
                `🚨 **بوت تخريب — تم احتواءه فوراً**\n` +
                `🤖 البوت: ${this.userLabel(executor)} (\`${executor.id}\`)\n` +
                `${banned ? '🔨 حظر فوري ✅' : '⚠️ تعذّر الحظر — ارفع رول البوت'}\n` +
                `🧹 حُذف ${purged} من آثاره (قنوات/رولات/ويب هوكس)`,
            })
            .catch(() => {})
        )
        .catch(() => {});

      logger.error(`🚨 ROGUE BOT neutralized: ${this.userLabel(executor)} in ${guild.name} | banned=${banned} purged=${purged}`);
      return true;
    } catch (error: any) {
      logger.error(`handleRogueBot error: ${error.message}`);
      return false;
    }
  }

  /** يمنع أي بوت غير مصرح من الدخول — حظر فوري بالمعرّف */
  private async guardBotJoin(guild: Guild, botId: string, member?: any): Promise<boolean> {
    try {
      if (!botId || botId === this.client.user?.id) return false;

      const settings = await getGuildSettings(guild.id);
      const antiBot = settings.protection?.antiBot;
      // 🛑 احترام إطفاء antiBot: لو مطفأ فعلاً لا نتدخل
      if (!antiBot?.enabled) return false;
      if (this.botWhitelist(settings).has(botId)) return false;

      // منع التكرار (قد يصل الحدث من Gateway ومن رد الفعل معاً)
      if (this.markHandled(`${guild.id}:botjoin:${botId}`)) return true;

      this.startIncident(guild.id, botId);
      const banned = await this.banUserById(
        guild,
        botId,
        'Liberty City — بوت غير مصرح به (Anti-Bot)'
      );
      if (!banned && member) {
        await member.kick('Liberty City — بوت غير مصرح به').catch(() => {});
      }

      void this.getAlertChannel(guild, settings, antiBot?.logChannel)
        .then(ch =>
          ch
            ?.send({
              content:
                `🤖 **بوت غير مصرح حاول الدخول — تم منعه فوراً**\n` +
                `البوت: <@${botId}> (\`${botId}\`)\n` +
                `${banned ? '🔨 حظر فوري ✅ (لا يستطيع العودة)' : '👢 تم طرده'}\n` +
                `📋 للسماح به: أضفه إلى قائمة antiBot البيضاء`,
            })
            .catch(() => {})
        )
        .catch(() => {});

      logger.warn(`🤖 Bot join blocked: ${botId} in ${guild.name}`);
      return true;
    } catch (error: any) {
      logger.error(`guardBotJoin error: ${error.message}`);
      return false;
    }
  }

  /** يستقبل كل سجل تدقيق من Gateway — يستخدمه للكشف الفوري الاستباقي */
  async onAuditEntry(entry: any, guildArg?: Guild): Promise<void> {
    const guild: Guild | undefined = guildArg ?? entry?.guild;
    if (guild) this.ingestAuditEntry(entry, guild.id);
    try {
      const executor = entry?.executor;
      if (!guild || !executor || executor.id === this.client.user?.id) return;

      // 🤖 بوت جديد انضم → حظره قبل أن يفعل أي شيء
      if (entry.action === AuditLogEvent.BotAdd) {
        const targetId = entry.targetId;
        if (!targetId || targetId === this.client.user?.id) return;
        const targetBot =
          (entry.target && typeof entry.target === 'object' && 'bot' in entry.target && entry.target.bot === true) ||
          guild.members.cache.get(targetId)?.user.bot === true;
        if (targetBot) await this.guardBotJoin(guild, targetId);
        return;
      }

      // 🤖 أي بوت غير مصرح ينشئ قناة/رول/ويب هوك → حظر فوري + حذف
      if (!this.executorIsBot(guild, executor)) return;
      if (entry.action === AuditLogEvent.ChannelCreate || entry.action === AuditLogEvent.ThreadCreate) {
        await this.handleRogueBot(guild, executor, 'channel', entry.targetId);
      } else if (entry.action === AuditLogEvent.RoleCreate) {
        await this.handleRogueBot(guild, executor, 'role', entry.targetId);
      } else if (entry.action === AuditLogEvent.WebhookCreate) {
        await this.handleRogueBot(guild, executor, 'webhook', entry.targetId);
      } else if (
        // ⚡ أي عملية تخريبية من بوت: حظر فوري من بثّ التدقيق قبل حتى أن يصل حدث Discord
        entry.action === AuditLogEvent.ChannelDelete ||
        entry.action === AuditLogEvent.ChannelOverwriteCreate ||
        entry.action === AuditLogEvent.ChannelOverwriteUpdate ||
        entry.action === AuditLogEvent.ThreadDelete ||
        entry.action === AuditLogEvent.RoleDelete ||
        entry.action === AuditLogEvent.EmojiDelete ||
        entry.action === AuditLogEvent.StickerDelete ||
        entry.action === AuditLogEvent.MemberBanAdd ||
        entry.action === AuditLogEvent.MemberKick ||
        entry.action === AuditLogEvent.MemberPrune ||
        entry.action === AuditLogEvent.MemberRoleUpdate ||
        entry.action === AuditLogEvent.MemberUpdate
      ) {
        await this.handleRogueBot(guild, executor, 'channel');
      }
    } catch (error: any) {
      logger.error(`onAuditEntry error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 🕵️ حارس البوتات الخطرة الموجودين أصلاً
  // --------------------------------------------
  public startDangerousBotWatchdog(guild: Guild): void {
    if (this.botGuardTimers.has(guild.id)) return;
    const run = () => this.auditDangerousBots(guild).catch(() => {});
    setTimeout(run, 4000).unref?.();
    const timer = setInterval(run, 30000);
    timer.unref?.();
    this.botGuardTimers.set(guild.id, timer);
  }

  async auditDangerousBots(guild: Guild): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;
      const antiBot = settings.protection?.antiBot;
      // 🛑 احترام إطفاء antiBot: لا تحييد لبوتات موجودة إذا كانت الحماية مطفأة
      if (!antiBot?.enabled) return;
      const wl = this.botWhitelist(settings);
      const dangerous: GuildMember[] = [];

      for (const [, member] of guild.members.cache) {
        if (!member.user.bot || wl.has(member.id)) continue;
        const p = member.permissions;
        // بوت "قادر على النيوك": مدير عام، أو يدير القنوات + (رولات/حظر/طرد/إدارة سيرفر)
        const nukeCapable =
          p.has(PermissionFlagsBits.Administrator) ||
          (p.has(PermissionFlagsBits.ManageChannels) &&
            (p.has(PermissionFlagsBits.ManageRoles) ||
              p.has(PermissionFlagsBits.BanMembers) ||
              p.has(PermissionFlagsBits.KickMembers) ||
              p.has(PermissionFlagsBits.ManageGuild)));
        if (nukeCapable) dangerous.push(member as GuildMember);
      }

      if (dangerous.length === 0) return;

      const names: string[] = [];
      for (const member of dangerous) {
        this.startIncident(guild.id, member.id);
        const ok = await this.banUserById(
          guild,
          member.id,
          'Liberty City — بوت خطِر غير مصرح (حارس البوتات)'
        );
        if (ok) names.push(`${member.user.tag} (حظر)`);
        else {
          const stripped = await member.roles
            .set([], 'Liberty City — سحب صلاحيات بوت خطِر')
            .then(() => true)
            .catch(() => false);
          names.push(
            stripped
              ? `${member.user.tag} (سحب رولات)`
              : `${member.user.tag} (⚠️ فشل — رول البوت أدنى من رول البوت الخطر)`
          );
        }
        await this.purgeAttackerArtifacts(guild, member.id, false).catch(() => 0);
      }

      if (names.length) {
        const ch = await this.getAlertChannel(guild, settings, cfg.logChannel);
        ch?.send({
          content:
            `🛡️ **حارس البوتات:** تم تحييد ${names.length} بوت بصلاحيات تخريبية\n` +
            names.slice(0, 10).map(n => `• ${n}`).join('\n') +
            `\n📋 إن كان أحدها شرعياً: أضفه لقائمة antiBot البيضاء من الإعدادات.`,
        }).catch(() => {});
        logger.warn(`🛡️ Dangerous bots neutralized in ${guild.name}: ${names.join(', ')}`);
      }
    } catch (error: any) {
      logger.error(`auditDangerousBots error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 💬 ويب هوك / بوت يسبام → حذف فوري + حظر
  // --------------------------------------------
  async onWebhookMessage(message: any): Promise<boolean> {
    try {
      if (!message?.guild || !message.webhookId) return false;
      const guild: Guild = message.guild;
      const settings = await getGuildSettings(guild.id);
      const nuke = settings.protection?.antiNuke;
      const spam = settings.protection?.antiSpam;
      // يحترم الإطفاء: لو الاثنان مطفآن لا نتدخل
      if (!nuke?.enabled && !spam?.enabled) return false;

      const key = `${guild.id}:wh:${message.webhookId}`;
      const now = Date.now();
      const arr = (this.messageRate.get(key) || []).filter(t => now - t < 3000);
      arr.push(now);
      this.messageRate.set(key, arr);

      const content = typeof message.content === 'string' ? message.content : '';
      const massMention =
        message.mentions?.everyone === true ||
        (message.mentions?.users?.size ?? 0) >= 5 ||
        (message.mentions?.roles?.size ?? 0) >= 3;
      const invite = /discord\.(gg|com\/invite)|discordapp\.com\/invite/i.test(content);
      const scam = /(?:free|nitro|steam|airdrop|claim).*(?:discord\.gg|bit\.ly|tinyurl|cutt\.ly)/i.test(content);
      const threshold = Math.max(4, Number(spam?.maxMessages) || 5);

      if (!massMention && !invite && !scam && arr.length < threshold) return false;

      // 1) احذف الرسالة والويب هوك فوراً (قبل أي انتظار)
      await message.delete().catch(() => {});
      const keyHandled = `${guild.id}:wh-handle:${message.webhookId}`;
      if (this.markHandled(keyHandled)) return true;

      let whOwnerId: string | undefined;
      try {
        const whs = await guild.fetchWebhooks();
        const target = whs.get(message.webhookId);
        whOwnerId = target?.owner?.id;
        await target?.delete('Liberty City — Anti-Webhook-Spam');
      } catch {}
      this.recordArtifact(guild.id, 'unknown', 'webhooks', message.webhookId);

      // 2) حدّد صانع الويب هوك: بثّ التدقيق → سجلات التدقيق → مالك الويب هوك نفسه
      let creator = await this.findAuditCreator(guild, AuditLogEvent.WebhookCreate, message.webhookId);
      if (!creator && whOwnerId) {
        creator = await this.client.users.fetch(whOwnerId).catch(() => null);
      }

      // 3) احذف رسائل الويب هوك السابقة
      void this.cleanupChannelMessages(message, (m: any) => m.webhookId === message.webhookId);

      let actionText = '🗑️ حذف الرسائل والويب هوك';
      if (creator && creator.id !== this.client.user?.id) {
        const trusted = await this.isTrustedExecutor(guild, creator.id);
        if (!trusted) {
          this.startIncident(guild.id, creator.id);
          const prevent = nuke?.mode !== 'react';
          const action: 'alert' | 'kick' | 'ban' | 'strip' = prevent
            ? 'ban'
            : ((nuke?.action ?? 'kick') as any);
          actionText += `\n${await this.punishById(
            guild,
            creator,
            action,
            'Liberty City — سبام ويب هوك (Anti-Nuke)'
          )}`;
          await this.purgeAttackerArtifacts(guild, creator.id).catch(() => 0);
        }
      }

      const ch = await this.getAlertChannel(guild, settings, nuke?.logChannel);
      ch?.send({
        content:
          `🚨 **سبام ويب هوك — تم إيقافه فوراً**\n` +
          `🔗 الويب هوك: \`${message.webhookId}\`\n` +
          `📢 القناة: <#${message.channelId}>\n` +
          `${actionText}\n` +
          `السبب: ${massMention ? '@everyone / منشن جماعي' : invite ? 'رابط دعوة' : scam ? 'رابط احتيالي' : `${arr.length} رسائل في 3 ثوانٍ`}`,
      }).catch(() => {});
      logger.warn(`🚨 Webhook spam contained in ${guild.name} (${message.webhookId})`);
      return true;
    } catch (error: any) {
      logger.error(`onWebhookMessage error: ${error.message}`);
      return false;
    }
  }

  async onBotMessage(message: any): Promise<boolean> {
    try {
      if (!message?.guild || !message.author?.bot || message.webhookId) return false;
      const guild: Guild = message.guild;
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return false;
      if (this.botWhitelist(settings).has(message.author.id)) return false;

      const key = `${guild.id}:bot:${message.author.id}`;
      const now = Date.now();
      const arr = (this.messageRate.get(key) || []).filter(t => now - t < 3000);
      arr.push(now);
      this.messageRate.set(key, arr);

      const content = typeof message.content === 'string' ? message.content : '';
      const massMention =
        message.mentions?.everyone === true ||
        (message.mentions?.users?.size ?? 0) >= 5 ||
        (message.mentions?.roles?.size ?? 0) >= 3;
      const invite = /discord\.(gg|com\/invite)|discordapp\.com\/invite/i.test(content);
      const threshold = 8;
      if (!(massMention && arr.length >= 2) && !invite && arr.length < threshold) return false;

      const handledKey = `${guild.id}:bot-handle:${message.author.id}`;
      if (this.markHandled(handledKey)) return true;

      this.startIncident(guild.id, message.author.id);
      void this.cleanupChannelMessages(message, (m: any) => m.author?.id === message.author.id);
      const banned = await this.banUserById(
        guild,
        message.author.id,
        'Liberty City — سبام من بوت غير مصرح (Anti-Nuke)'
      );
      await this.purgeAttackerArtifacts(guild, message.author.id).catch(() => 0);

      const ch = await this.getAlertChannel(guild, settings, cfg.logChannel);
      ch?.send({
        content:
          `🚨 **بوت يسبام — تم إيقافه فوراً**\n` +
          `🤖 ${message.author.tag} (\`${message.author.id}\`)\n` +
          `📢 القناة: <#${message.channelId}> — ${arr.length} رسائل/3 ثوانٍ\n` +
          `${banned ? '🔨 حظر فوري ✅' : '⚠️ تعذّر الحظر — راجع تسلّم البوت'}`,
      }).catch(() => {});
      logger.warn(`🚨 Spamming bot neutralized: ${message.author.tag} in ${guild.name}`);
      return true;
    } catch (error: any) {
      logger.error(`onBotMessage error: ${error.message}`);
      return false;
    }
  }

  private async cleanupChannelMessages(message: any, predicate: (m: any) => boolean): Promise<void> {
    try {
      const channel = message.channel;
      if (!channel?.messages?.fetch) return;
      const fetched = await channel.messages.fetch({ limit: 50 });
      const targets = [...fetched.values()].filter(predicate);
      if (targets.length === 0) return;
      if (targets.length > 1 && typeof channel.bulkDelete === 'function') {
        await channel.bulkDelete(targets, true).catch(async () => {
          for (const m of targets) await m.delete().catch(() => {});
        });
      } else {
        for (const m of targets) await m.delete().catch(() => {});
      }
    } catch {}
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
      // 🤖 قائمة البوتات الموثوقة (antiBot) — البوتات المصرح بها لا تُعاقب
      const botWl = settings.protection?.antiBot?.whitelist;
      if (Array.isArray(botWl) && botWl.map(String).includes(executorId)) return true;
    } catch { /* تجاهل */ }
    return false;
  }

  /** هل المنفّذ بوت؟ — يعمل حتى لو كان كائن المستخدم جزئياً (من سجلات التدقيق) */
  private executorIsBot(guild: Guild, executor: any): boolean {
    if (!executor) return false;
    if (executor.bot === true) return true;
    if (executor.bot === false) return false;
    return guild.members.cache.get(executor.id)?.user.bot === true;
  }

  /** اسم مقروء للمنفّذ حتى لو كان جزئياً */
  private userLabel(user: any): string {
    return user?.tag || user?.username || user?.id || 'unknown';
  }

  // --------------------------------------------
  // 0) ANTI-CREATE: أي بوت ينشئ قناة/رول → يُحذف فوراً (ماعدا الأونر والإدارة)
  // --------------------------------------------
  async onChannelCreate(channel: any): Promise<void> {
    try {
      if (!channel?.guild) return;
      if (this.handledTargets.has(`${channel.guild.id}:ch-target:${channel.id}`)) return;

      const guild: Guild = channel.guild;
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      // 🛑 احترام الإطفاء — لا حماية عندما يكون مضاد النيوك مطفأ
      if (!cfg?.enabled) return;

      const executor = await this.findExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);
      if (!executor) return; // بثّ التدقيق سيصل غالباً — لا نحذف عمياء (قد نحذف قناة استعادة)
      if (executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(guild, executor.id)) return;

      this.recordArtifact(guild.id, executor.id, 'channels', channel.id);
      this.handledTargets.set(`${guild.id}:ch-target:${channel.id}`, Date.now());

      // 🤖 بوت غير مصرح: صفر تسامح — حظر فوري + حذف القناة + كل آثاره
      if (this.executorIsBot(guild, executor)) {
        await this.handleRogueBot(guild, executor, 'channel', channel.id);
        return;
      }

      // 🧑 إنسان: قناة واحدة قد تكون طبيعية — نتدخل عند الانفجار (2+ خلال 5 ثوانٍ)
      //    أو إذا كان الحادث نشطاً على نفس المنفّذ.
      const burst = this.trackCreate(guild.id, executor.id, 'channel', 5000);
      const suspiciousName = /nuked|hacked|kly|cracked|death.?note|pwned|on.?top|raid|destroy/i.test(channel.name || '');
      if (burst < 2 && !suspiciousName && !this.isActiveAttacker(guild.id, executor.id)) return;

      this.startIncident(guild.id, executor.id);
      channel.delete('Liberty City — إنشاء قنوات جماعي (Anti-Nuke)').catch(() => {});

      if (burst === 2 || suspiciousName) {
        const reason = 'Liberty City — إنشاء قنوات جماعي مشبوه (Anti-Nuke)';
        const prevent = cfg.mode !== 'react';
        const action: 'alert' | 'kick' | 'ban' | 'strip' = prevent
          ? 'ban'
          : ((cfg.action ?? 'kick') as any);
        const text = await this.punishById(guild, executor, action, reason);
        await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);

        void this.getAlertChannel(guild, settings, cfg.logChannel)
          .then(ch =>
            ch
              ?.send({
                content:
                  `🚨 **هجوم إنشاء قنوات — تم احتواؤه**\n` +
                  `👤 ${this.userLabel(executor)} (${this.executorIsBot(guild, executor) ? '🤖 بوت' : '🧑 عضو'})\n` +
                  `📢 أنشأ ${burst} قنوات خلال 5 ثوانٍ\n` +
                  `${text}\n🧹 حُذفت قنوات المهاجم`,
              })
              .catch(() => {})
          )
          .catch(() => {});
      }
    } catch (error: any) {
      logger.error(`onChannelCreate error: ${error.message}`);
    }
  }

  // عدّاد إنشاء سريع لكل منفّذ (نافذة زمنية)
  private trackCreate(guildId: string, userId: string, kind: 'channel' | 'role', windowMs: number): number {
    const now = Date.now();
    const key = `${guildId}:${kind}:${userId}`;
    const arr = (this.createTracker.get(key) || []).filter(t => now - t <= windowMs);
    arr.push(now);
    this.createTracker.set(key, arr);
    return arr.length;
  }

  async onRoleCreate(role: any): Promise<void> {
    try {
      if (!role?.guild || role.managed) return;

      const guild: Guild = role.guild;
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return;

      const executor = await this.findExecutor(guild, AuditLogEvent.RoleCreate, role.id);
      if (!executor) return;
      if (executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(guild, executor.id)) return;

      this.recordArtifact(guild.id, executor.id, 'roles', role.id);

      // 🤖 بوت غير مصرح: صفر تسامح
      if (this.executorIsBot(guild, executor)) {
        await this.handleRogueBot(guild, executor, 'role', role.id);
        return;
      }

      // 🧑 إنسان: انفجار 2+ خلال 5 ثوانٍ أو اسم مشبوه أو حادث نشط
      const burst = this.trackCreate(guild.id, executor.id, 'role', 5000);
      const suspiciousName = /nuked|hacked|kly|cracked|death.?note|pwned|on.?top|raid|destroy/i.test(role.name || '');
      if (burst < 2 && !suspiciousName && !this.isActiveAttacker(guild.id, executor.id)) return;

      this.startIncident(guild.id, executor.id);
      role.delete('Liberty City — إنشاء رولات جماعي (Anti-Nuke)').catch(() => {});

      if (burst === 2 || suspiciousName) {
        const prevent = cfg.mode !== 'react';
        const action: 'alert' | 'kick' | 'ban' | 'strip' = prevent
          ? 'ban'
          : ((cfg.action ?? 'kick') as any);
        const text = await this.punishById(
          guild,
          executor,
          action,
          'Liberty City — إنشاء رولات جماعي مشبوه (Anti-Nuke)'
        );
        await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);

        void this.getAlertChannel(guild, settings, cfg.logChannel)
          .then(ch =>
            ch
              ?.send({
                content:
                  `🚨 **هجوم إنشاء رولات — تم احتواؤه**\n` +
                  `👤 ${this.userLabel(executor)} (${this.executorIsBot(guild, executor) ? '🤖 بوت' : '🧑 عضو'})\n` +
                  `🎭 أنشأ ${burst} رولات خلال 5 ثوانٍ\n` +
                  `${text}\n🧹 حُذفت رولات المهاجم`,
              })
              .catch(() => {})
          )
          .catch(() => {});
      }
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
      const guild: Guild = webhook.guild;
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return; // احترام الإطفاء

      const entryGuild = webhook.guild;
      const executor = await this.findExecutor(entryGuild, AuditLogEvent.WebhookCreate, webhook.id);
      if (!executor) return;
      if (executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(entryGuild, executor.id)) return;

      this.recordArtifact(guild.id, executor.id, 'webhooks', webhook.id);

      // 🤖 بوت غير مصرح → صفر تسامح
      if (this.executorIsBot(guild, executor)) {
        await this.handleRogueBot(guild, executor, 'webhook', webhook.id);
        return;
      }

      // 🧑 إنسان: ويب هوك جديد من غير الموثوقين = أداة سبام محتملة → احتواء فوري
      webhook.delete('Liberty City — ويب هوك غير مصرح').catch(() => {});
      this.startIncident(guild.id, executor.id);
      const prevent = cfg.mode !== 'react';
      const action: 'alert' | 'kick' | 'ban' | 'strip' = prevent ? 'ban' : ((cfg.action ?? 'kick') as any);
      const text = await this.punishById(guild, executor, action, 'Liberty City — إنشاء ويب هوك (Anti-Nuke)');
      await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);

      void this.getAlertChannel(guild, settings, cfg.logChannel)
        .then(ch =>
          ch
            ?.send({
              content:
                `🚨 **ويب هوك غير مصرح — تم احتواؤه**\n` +
                `👤 ${this.userLabel(executor)}\n🔗 \`${webhook.id}\`\n${text}`,
            })
            .catch(() => {})
        )
        .catch(() => {});
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
      const guild = newMember.guild;
      const settings = await getGuildSettings(guild.id);
      const antiNuke = settings.protection?.antiNuke;
      if (!antiNuke?.enabled) return;

      // ⚡ تحديد المنفّذ من بثّ التدقيق الفوري أولاً (بدون REST بطيء)
      const executor = await this.findExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      if (!executor) return;
      if (executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(guild, executor.id)) return;

      const me = guild.members.me;
      const canManageRoles = me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;

      let rolesRestored = false;
      if (canManageRoles) {
        try {
          await newMember.roles.remove(addedRoles, 'Security: unauthorized role assignment');
          rolesRestored = true;
        } catch {}
      }

      // 🛡️ وضع المنع: إعطاء رول من منفّذ غير موثوق = اعتداء → عقوبة فورية بالمعرّف
      const preventMode = antiNuke.mode !== 'react';
      const action: 'alert' | 'kick' | 'ban' | 'strip' = preventMode
        ? 'ban'
        : ((antiNuke.action ?? 'kick') as any);
      const punishText = await this.punishById(
        guild,
        executor,
        action,
        'Liberty City Anti-Nuke: إعطاء رولات بدون تصريح'
      );
      await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);

      const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
      const executorType = this.executorIsBot(guild, executor) ? '🤖 بوت' : '👤 عضو';
      let msg = `🎭 **${executorType} أعطى رول:** ${this.userLabel(executor)}\n`;
      msg += `👤 الهدف: ${newMember.user.tag}\n`;
      msg += `🔄 استرجاع الرولات: ${rolesRestored ? '✅' : canManageRoles ? '❌' : '⚠️ لا توجد صلاحية ManageRoles'}\n`;
      msg += `🛡️ العقوبة: ${punishText}`;
      alert?.send({ content: msg }).catch(() => {});

    } catch (error: any) {
      logger.error(`onGuildMemberUpdate error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // PREVENTIVE: ANTI-@EVERYONE DANGEROUS PERMISSIONS
  // يمنع أي تغيير يعطي @everyone صلاحيات: Administrator, ManageChannels, ManageRoles, BanMembers, KickMembers, MentionEveryone
  // --------------------------------------------
  async onChannelPermissionUpdate(oldChannel: any, newChannel: any): Promise<void> {
    try {
      if (!newChannel?.guild) return;
      
      // فحص سريع: هل فيه تغيير في أوفررايتس @everyone؟
      const everyoneRoleId = newChannel.guild.id;
      const oldEveryone = oldChannel.permissionOverwrites?.cache?.get(everyoneRoleId);
      const newEveryone = newChannel.permissionOverwrites?.cache?.get(everyoneRoleId);
      
      if (!newEveryone) return; // مفيش أوفررايت على @everyone
      
      const DANGEROUS_PERMS = [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.MentionEveryone,
        PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.ManageGuild,
      ];
      
      // فحص: هل الـ allow الجديد فيه صلاحيات خطيرة؟
      const newAllow = newEveryone.allow?.bitfield ?? 0n;
      const oldAllow = oldEveryone?.allow?.bitfield ?? 0n;
      
      let dangerousAdded = false;
      for (const perm of DANGEROUS_PERMS) {
        const permBit = BigInt(perm);
        if ((newAllow & permBit) !== 0n && (oldAllow & permBit) === 0n) {
          dangerousAdded = true;
          break;
        }
      }
      
      if (!dangerousAdded) return; // مفيش صلاحيات خطيرة جديدة
      
      const guild = newChannel.guild;
      const settings = await getGuildSettings(guild.id);
      const antiNuke = settings.protection?.antiNuke;
      if (!antiNuke?.enabled) return; // احترام الإطفاء قبل أي طلب

      // جلب المنفّذ
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (Date.now() - entry.createdTimestamp > 1000) return; // نافذة أضيق = 1 ثانية
      if (entry.executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(guild, entry.executor.id)) return;
      
      const member = guild.members.cache.get(entry.executor.id);
      if (!member) return;
      
      const hierarchy = this.checkHierarchy(guild);
      if (!hierarchy.ok) {
        const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
        alert?.send({ content: `⚠️ **فشل منع @everyone危险权限** — البوت ليس أعلى رتبة! اسحب رول البوت للأعلى.` }).catch(() => {});
        return;
      }
      
      const me = guild.members.me;
      const canManageChannels = me?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
      const canKick = me?.permissions.has(PermissionFlagsBits.KickMembers) ?? false;
      const canBan = me?.permissions.has(PermissionFlagsBits.BanMembers) ?? false;
      
      let permsRestored = false;
      let punished = false;
      let punishType = 'none';
      
      // 1️⃣ إرجاع الأوفررايت فوراً
      if (canManageChannels && oldEveryone) {
        try {
          await newChannel.permissionOverwrites.edit(everyoneRoleId, oldEveryone, 'Security: @everyone dangerous perm reverted');
          permsRestored = true;
        } catch (e: any) {
          logger.warn(`Failed to restore @everyone perms in ${guild.name}: ${e.message}`);
        }
      }
      
      // 3️⃣ العقوبة
      const action = antiNuke.action || 'kick';
      if (action !== 'alert' && member) {
        if (action === 'strip' && canKick) {
          try { await member.roles.set([], 'Security: @everyone dangerous perm'); punished = true; punishType = 'strip'; } catch {}
        } else if (action === 'kick' && canKick) {
          try { await member.kick('Security: @everyone dangerous perm'); punished = true; punishType = 'kick'; } catch {}
        } else if (action === 'ban' && canBan) {
          try { await member.ban({ reason: 'Security: @everyone dangerous perm (anti-nuke)' }); punished = true; punishType = 'ban'; } catch {}
        }
      }
      
      // 4️⃣ تنبيه أحمر
      const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
      const executorType = entry.executor.bot ? '🤖 بوت' : '👤 عضو';
      let msg = `🚨 **${executorType} حاول إعطاء @everyone صلاحيات خطيرة!**\n`;
      msg += `👤 المنفّذ: ${entry.executor.tag}\n`;
      msg += `📍 القناة: <#${newChannel.id}>\n`;
      msg += `🔄 استرجاع الصلاحيات: ${permsRestored ? '✅ تم' : '❌ فشل'}\n`;
      if (action === 'alert') msg += `🔔 الإجراء: تنبيه فقط`;
      else msg += `🛡️ العقوبة (${action}): ${punished ? `✅ ${punishType}` : '❌ فشل'}`;
      alert?.send({ content: msg }).catch(() => {});
      
      logger.error(`🚨 ANTI-@EVERYONE triggered in ${guild.name} by ${entry.executor.tag} on #${newChannel.name}`);
      
    } catch (error: any) {
      logger.error(`onChannelPermissionUpdate (@everyone) error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // PREVENTIVE: BOT JOIN FILTER — يمنع بوتات مش موثوقة
  // --------------------------------------------
  async onGuildMemberAdd(member: any): Promise<void> {
    try {
      if (!member?.guild || !member.user?.bot) return;
      await this.guardBotJoin(member.guild, member.id, member);
    } catch (error: any) {
      logger.error(`onGuildMemberAdd (anti-bot) error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // PREVENTIVE: NUKE DETECTION — كشف عمليات جماعية
  // --------------------------------------------
  private trackNukeActivity(guildId: string, type: 'channel' | 'role' | 'webhook'): boolean {
    const now = Date.now();
    const tracker = this.nukeTracker.get(guildId) || { channels: 0, roles: 0, webhooks: 0, lastAction: now };
    
    // Reset إذا مرت 10 ثواني
    if (now - tracker.lastAction > 10000) {
      tracker.channels = 0;
      tracker.roles = 0;
      tracker.webhooks = 0;
    }
    
    // زيادة العداد الصحيح
    if (type === 'channel') tracker.channels++;
    else if (type === 'role') tracker.roles++;
    else if (type === 'webhook') tracker.webhooks++;
    
    tracker.lastAction = now;
    this.nukeTracker.set(guildId, tracker);
    
    // كشف نكهة: 3+ قنوات أو 3+ رولات أو 2+ ويب هوك في 10 ثواني
    return tracker.channels >= 3 || tracker.roles >= 3 || tracker.webhooks >= 2;
  }

  // إضافة tracking في onChannelCreate
  // إضافة tracking في onRoleCreate
  // إضافة tracking في onWebhookUpdate

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
      const everyoneRole = guild.roles.everyone;
      try {
        await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false, AddReactions: false }, 'Security: mass message delete detected').catch(() => {});
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
          { name: 'المخالف', value: executor ? `${executor} (\`${this.userLabel(executor)}\`)${isWhitelisted ? ' 👑' : ''}` : 'غير معروف', inline: true },
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
      const guild: Guild = thread.guild;
      const settings = await getGuildSettings(guild.id);
      const cfg = settings.protection?.antiNuke;
      if (!cfg?.enabled) return; // احترام الإطفاء

      const executor = await this.findExecutor(guild, AuditLogEvent.ThreadCreate, thread.id);
      if (!executor) return;
      if (executor.id === this.client.user?.id) return;
      if (await this.isTrustedExecutor(guild, executor.id)) return;

      // أي بوت غير مصرح ينشئ ثريد → حظر فوري + حذف
      if (this.executorIsBot(guild, executor)) {
        try { await thread.delete('Liberty City — بوت غير مصرح أنشأ ثريد'); } catch {}
        const prevent = cfg.mode !== 'react';
        const action: 'alert' | 'kick' | 'ban' | 'strip' = prevent ? 'ban' : ((cfg.action ?? 'kick') as any);
        const text = await this.punishById(guild, executor, action, 'Liberty City — بوت أنشأ ثريد (Anti-Nuke)');
        await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);

        void this.getAlertChannel(guild, settings, cfg.logChannel)
          .then(ch =>
            ch
              ?.send({ content: `🧵 **بوت حاول إنشاء ثريد:** ${this.userLabel(executor)} — ${text}` })
              .catch(() => {})
          )
          .catch(() => {});
        return;
      }

      // 🧑 إنسان: انفجار ثريدات (3+ خلال 10 ثوانٍ) = هجوم
      const burst = this.trackCreate(guild.id, executor.id, 'channel', 10000);
      if (burst < 3) return;

      this.startIncident(guild.id, executor.id);
      try { await thread.delete('Liberty City — إنشاء ثريدات جماعي'); } catch {}
      const prevent = cfg.mode !== 'react';
      const action: 'alert' | 'kick' | 'ban' | 'strip' = prevent ? 'ban' : ((cfg.action ?? 'kick') as any);
      const text = await this.punishById(guild, executor, action, 'Liberty City — إنشاء ثريدات جماعي');
      await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);

      void this.getAlertChannel(guild, settings, cfg.logChannel)
        .then(ch =>
          ch
            ?.send({ content: `🧵 **هجوم ثريدات:** ${this.userLabel(executor)} أنشأ ${burst} ثريدات — ${text}` })
            .catch(() => {})
        )
        .catch(() => {});
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
      if (executor.id === this.client.user?.id) return; // طرد شرعي من البوت نفسه
      if (await this.isTrustedExecutor(member.guild, executor.id)) return; // مالك/مطوّر/وايت ليست

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
      /** 🛡️ وضع المنع الوقائي: أول اعتداء = حظر فوري + حجر الصلاحيات */
      mode?: 'prevent' | 'react';
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

    // ⏱ استجابة فورية — لكن صامتة لو المنفّذ هو البوت نفسه
    if (executor && executor.id === this.client.user?.id) {
      logger.info(`⏭️ Anti-Nuke: تخطّي — المنفّذ هو البوت نفسه (${type} في ${guild.name})`);
      return;
    }

    // 👑 ثقة: المالك + مطوّر البوت + القائمة البيضاء
    const trusted = executor ? await this.isTrustedExecutor(guild, executor.id) : false;
    // تصرفات المالك/المطوّر/الوايت ليست شرعية — لا عقوبة ولا استعادة ولا تنبيه
    if (executor && trusted) return;

    // 🔨 الحظر يُلغى فوراً عن الضحية — بالتوازي مع كل شيء
    void (type === 'ban' && targetId && executor && !trusted
      ? guild.members.unban(targetId, 'Liberty City Anti-Nuke: إلغاء حظر الضحية تلقائياً').catch(() => {})
      : Promise.resolve());

    // 🛡️ وضع المنع الوقائي: أول عملية اعتداء = حظر فوري
    const preventMode = cfg.mode !== 'react';
    const effectiveAction: 'alert' | 'kick' | 'ban' | 'strip' = preventMode ? 'ban' : (cfg.action ?? 'kick');

    // ♻️ الاستعادة تبدأ الآن فوراً — بالتوازي مع العقوبة والتنبيه (لا ننتظر شيئاً)
    const restoreP: Promise<unknown> =
      (type === 'channel' || type === 'role') && cfg.autoRestore !== false && !trusted
        ? this.runAutoRestore(guild, settings, type)
            .then(() => this.cleanupSuspicious(guild).catch(() => {}))
            .catch((err: any) => logger.error(`runAutoRestore failed: ${err?.message ?? err}`))
        : Promise.resolve();

    let actionText: string;
    let punishP: Promise<string> = Promise.resolve('');
    let purgeP: Promise<number> = Promise.resolve(0);

    if (!executor) {
      actionText = '⚠️ تعذّر تحديد المنفّذ من سجلات التدقيق';
    } else if (trusted) {
      actionText = '⏭️ المنفّذ موثوق (مالك/مطوّر/وايت ليست) — لا عقوبة';
    } else {
      // 🚨 حادث نشط — يمنع أي إنشاء جديد من نفس المهاجم فوراً
      this.startIncident(guild.id, executor.id);
      const reason = `Liberty City Anti-Nuke: ${labels[type].label} — ردّ فوري${preventMode ? ' (وضع المنع)' : ''}`;
      // ⚡ عقوبة بالمعرّف مباشرة — أسرع مسار ممكن (بدون جلب عضو أو سحب رولات متسلسل)
      punishP = this.punishById(guild, executor, effectiveAction, reason);
      // 🧹 حذف كل ما أنشأه المهاجم (قنوات/رولات/ويب هوكس) — بالتوازي
      purgeP = this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
      actionText = preventMode ? '🛡️ وضع المنع: تحييد فوري جارٍ…' : '⏳ تنفيذ العقوبة…';
    }

    // ننتظر العقوبة فقط (سريعة) — الاستعادة والتطهير يكملان بالخلفية
    if (executor && !trusted) {
      const punishResult = await punishP.catch((err: any) => `⚠️ ${err?.message ?? 'فشل'}`);
      if (punishResult) actionText = preventMode ? `🛡️ **وضع المنع** — ${punishResult}` : punishResult;
      void purgeP.then(n => {
        if (n > 0) logger.info(`🧹 Anti-Nuke purge: حُذف ${n} من آثار ${this.userLabel(executor)} في ${guild.name}`);
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(preventMode ? `🚨 تحذير أمني — وضع المنع الوقائي` : `🚨 تحذير أمني — استجابة فورية`)
      .setDescription(
        `${labels[type].emoji} تنفيذ عملية **${labels[type].label}** — ردّ أمني **فوري من أول عملية** (نافذة الرصد ${windowSec}ث) — نمط هجوم "نيوك"!`
      )
      .setColor(Colors.error)
      .addFields(
        { name: 'المخالف', value: executor ? `${executor} (\`${this.userLabel(executor)}\`)${trusted ? ' 👑' : ''}` : 'غير معروف', inline: true },
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

    // ♻️ الاستعادة انطلقت مسبقاً بالتوازي (لا ننتظرها هنا حتى لا نبطئ بقية الأحداث)
    const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
    if (channel) {
      void channel
        .send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined })
        .catch(() => {});
    }

    logger.warn(
      `🚨 Anti-Nuke (فوري): ${type} في ${guild.name} | executor=${executor?.tag ?? 'unknown'} | ${actionText}`
    );

    void restoreP;
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
      // 🛡️ منع فوري بالمعرّف (حظر) وليس مجرد طرد — لا يمكنه العودة
      return await this.guardBotJoin(member.guild, member.user.id, member);
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
            value: executor ? `${executor} (\`${this.userLabel(executor)}\`)` : '⚠️ غير معروف — راجع سجل التدقيق',
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

      const guild = newRole.guild;
      const settings = await getGuildSettings(guild.id);

      const gainedAdmin =
        !oldRole.permissions.has(PermissionFlagsBits.Administrator) &&
        newRole.permissions.has(PermissionFlagsBits.Administrator);

      const antiAdminCfg = settings.protection?.antiAdmin;
      const nukeCfg = settings.protection?.antiNuke;

      // 🛡️ حاجز الصلاحيات — وضع المنع الوقائي: يمنع الهكر من بناء ذراعه من الأساس
      //    أي رول يكتسب صلاحية "نيوك" (إدارة/حظر/طرد/ويبهوك/منشن الجميع/مدير) من منفّذ غير موثوق
      //    → إرجاع الصلاحيات القديمة فوراً + حجر المهاجم + عقوبة
      const permNames = new Map<bigint, string>([
        [PermissionFlagsBits.Administrator, 'المدير العام'],
        [PermissionFlagsBits.ManageGuild, 'إدارة السيرفر'],
        [PermissionFlagsBits.ManageChannels, 'إدارة القنوات'],
        [PermissionFlagsBits.ManageRoles, 'إدارة الرولات'],
        [PermissionFlagsBits.ManageWebhooks, 'إدارة الويبهوكس'],
        [PermissionFlagsBits.BanMembers, 'حظر الأعضاء'],
        [PermissionFlagsBits.KickMembers, 'طرد الأعضاء'],
        [PermissionFlagsBits.MentionEveryone, 'منشن الجميع'],
      ]);
      const DANGEROUS: bigint[] = [...permNames.keys()];
      const deferToAntiAdmin = gainedAdmin && !!antiAdminCfg?.enabled;
      const gainedDangerous: bigint[] = nukeCfg?.enabled
        ? DANGEROUS.filter((p) => {
            if (p === PermissionFlagsBits.Administrator && deferToAntiAdmin) return false; // antiAdmin يتكفل بها بالأسفل
            return !oldRole.permissions.has(p) && newRole.permissions.has(p);
          })
        : [];

      if (!gainedAdmin && gainedDangerous.length === 0) return;

      if (gainedDangerous.length > 0) {
        const executor = await this.findExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
        if (
          executor &&
          executor.id !== this.client.user?.id &&
          !(await this.isTrustedExecutor(guild, executor.id))
        ) {
          const preventMode = nukeCfg?.mode !== 'react';

          // 1️⃣ إرجاع الصلاحيات القديمة فوراً — استدعاء واحد يلغي كل المكاسب (مدير/إدارة/حظر…)
          let reverted = false;
          try {
            await newRole.setPermissions(
              oldRole.permissions,
              'Liberty City Permission Guard: dangerous permissions reverted'
            );
            reverted = true;
          } catch (e: any) {
            logger.warn(`Permission guard: revert failed in ${guild.name}: ${e.message}`);
          }

          // 2️⃣ العقوبة — وضع المنع: حجر الصلاحيات ثم حظر فوري
          let punishText = 'تنبيه فقط';
          const executorMember = guild.members.cache.get(executor.id);
          if (executorMember && preventMode) {
            await executorMember.roles
              .set([], 'Liberty City Anti-Nuke: وضع المنع — حجر الصلاحيات')
              .catch(() => {});
          }
          if (executorMember) {
            const act: 'alert' | 'kick' | 'ban' | 'strip' = preventMode
              ? 'ban'
              : ((nukeCfg?.action ?? 'kick') as 'alert' | 'kick' | 'ban' | 'strip');
            punishText = await this.punish(
              guild,
              executor,
              act,
              'Liberty City Permission Guard: منح صلاحيات خطيرة (حاجز الصلاحيات)'
            );
          }

          // 3️⃣ تقرير أمني
          const names = gainedDangerous
            .map((p) => permNames.get(p) ?? 'صلاحية خطيرة')
            .join('، ');
          const alert = await this.getAlertChannel(guild, settings, nukeCfg?.logChannel);
          alert?.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🛡️ حاجز الصلاحيات — الهجوم أُبطل من الأساس')
                .setDescription(
                  `${preventMode ? '🛡️ **وضع المنع**:' : '⚠️'} رول **${newRole.name}**${newRole.id === guild.id ? ' (@everyone)' : ''} حاول الحصول على: **${names}**\n` +
                    `تم إرجاع الصلاحيات ${reverted ? 'فوراً ✅' : 'فشل الاسترجاع ❌ (افحص الهرمية)'} — فلا يستطيع أحد النيوك أصلاً.`
                )
                .setColor(Colors.error)
                .addFields(
                  { name: 'المنفّذ', value: `${executor.bot ? '🤖' : '👤'} ${executor.tag}`, inline: true },
                  { name: 'العقوبة', value: punishText, inline: true },
                  { name: '🛡️ مستوى تسلّم البوت', value: await this.hierarchyField(guild), inline: false }
                )
                .setFooter({ text: 'Liberty City — Permission Guard' })
                .setTimestamp(),
            ],
          }).catch(() => {});

          logger.warn(
            `🛡️ Permission guard: reverted [${names}] on ${newRole.name} in ${guild.name} | reverted=${reverted} | punish=${punishText}`
          );

          if (!deferToAntiAdmin) return; // لا يوجد منح Administrator — انتهى الحارس هنا
        }
      }

      if (!gainedAdmin) return;
      const cfg = antiAdminCfg;
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
      //    (وضع المنع: إرجاع كامل للصلاحيات القديمة — يلغي أيضاً أي صلاحيات خطيرة أخرى اكتسبها الرول)
      if (canManageRoles) {
        try {
          if (nukeCfg?.enabled) {
            await newRole.setPermissions(
              oldRole.permissions,
              'Security: permissions reverted (anti-admin + permission guard)'
            );
          } else {
            const perms = newRole.permissions;
            perms.remove(PermissionFlagsBits.Administrator);
            await newRole.setPermissions(perms, 'Security: Administrator revoked (anti-admin)');
          }
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
      .map(c => {
        const guildChannel = c as any; // GuildChannel types
        const base = {
          id: c.id,
          name: c.name,
          type: c.type,
          position: 'position' in c ? guildChannel.position : 0,
          topic: guildChannel.topic ?? null,
          parentId: c.parentId ?? null,
          nsfw: guildChannel.nsfw ?? false,
          rateLimitPerUser: guildChannel.rateLimitPerUser ?? 0,
        };
        // حفظ الأوفررايتس (الصلاحيات)
        let permissionOverwrites: any[] = [];
        if (guildChannel.permissionOverwrites?.cache) {
          permissionOverwrites = guildChannel.permissionOverwrites.cache.map((ow: any) => ({
            id: ow.id,
            type: ow.type, // 'role' | 'member'
            allow: ow.allow?.toString() ?? '0',
            deny: ow.deny?.toString() ?? '0',
          }));
        }
        return { ...base, permissionOverwrites };
      })
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

    // 1) الرولات — إنشاء بالترتيب الدقيق من النسخة الاحتياطية
    const sortedRoles = [...(data.roles || [])].sort((a, b) => (b.position || 0) - (a.position || 0));
    
    for (const rd of sortedRoles) {
      if (SUSPICIOUS_PATTERN.test(rd.name)) { result.skipped++; continue; }
      
      // التحقق من وجود الرول (بالمعرف أو بالاسم + الموقع)
      let exists = guild.roles.cache.get(rd.id);
      if (!exists) {
        // البحث بالرول اللي بنفس الاسم ومفيش conflict
        exists = guild.roles.cache.find(r => r.name === rd.name && r.id !== guild.id);
      }
      if (exists) {
        idMap[`role:${rd.id}`] = exists.id;
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
        } catch (error: any) {
          const isRateLimit =
            error?.status === 429 ||
            error?.httpStatus === 429 ||
            /rate limit|too many/i.test(error?.message || '');
          if (isRateLimit) {
            const retryAfter = error?.retry_after ?? error?.data?.retry_after ?? 60;
            const waitMs = Math.min((Number(retryAfter) || 60) * 1000 + 3000, 700000);
            logger.warn(`restore role "${rd.name}" — rate limited, waiting ${Math.round(waitMs / 1000)}s`);
            await sleep(waitMs);
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

    // 2) إعادة ترتيب الرولات بدقة حسب النسخة الاحتياطية
    if (result.roles > 0) {
      try {
        await sleep(2000);
        const curRoles = await guild.roles.fetch();
        const nameToRole = new Map<string, Role>();
        for (const [, role] of curRoles) {
          if (role.managed || role.id === guild.id) continue;
          if (!nameToRole.has(role.name)) {
            nameToRole.set(role.name, role);
          }
        }

        const positions: Array<{ role: string; position: number }> = [];
        // استخدام الترتيب من النسخة الاحتياطية مباشرة
        for (const rd of sortedRoles) {
          if (SUSPICIOUS_PATTERN.test(rd.name)) continue;
          const role = nameToRole.get(rd.name);
          if (role && role.id !== guild.id) {
            // الموقع الدقيق من النسخة (أعلى position = رقم أعلى)
            positions.push({ role: role.id, position: rd.position || 0 });
          }
        }

        if (positions.length > 1) {
          // ترتيب تنازلي للأعلى أولاً
          positions.sort((a, b) => b.position - a.position);
          await guild.roles.setPositions(positions);
          logger.info(`📐 Reordered ${positions.length} roles to match backup positions exactly`);
        }
      } catch (error: any) {
        logger.warn(`Role reorder failed: ${error.message}`);
      }
    }

    // 3) القنوات — الفئات أولاً، ثم الترتيب الدقيق
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
        idMap[`ch:${cd.id}`] = exists.id;
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

        // ضبط الموقع بدقة من النسخة الاحتياطية
        if (typeof cd.position === 'number' && cd.position >= 0) {
          await created.setPosition(cd.position).catch(() => {});
        }
      } catch (error: any) {
        logger.warn(`restore channel "${cd.name}" failed: ${error.message}`);
        result.skipped++;
      }
      await sleep(700);
    }

    // 4) ضبط صلاحيات القنوات (overwrites) من النسخة الاحتياطية
    if (result.channels > 0) {
      try {
        await sleep(1000);
        for (const cd of sortedChannels) {
          if (!RESTORABLE_CHANNEL_TYPES.includes(cd.type)) continue;
          if (SUSPICIOUS_PATTERN.test(cd.name)) continue;
          
          const channelId = idMap[`ch:${cd.id}`] || guild.channels.cache.get(cd.id)?.id;
          if (!channelId) continue;
          
          const channel = guild.channels.cache.get(channelId);
          if (!channel || !cd.permissionOverwrites) continue;
          
          for (const ow of cd.permissionOverwrites) {
            if (!ow.id || !ow.allow || !ow.deny) continue;
            
            // تحويل الـ ID القديم للـ ID الجديد للرول
            let targetId = ow.id;
            if (ow.type === 'role') {
              targetId = idMap[`role:${ow.id}`] || ow.id;
            }
            
            try {
              const gChannel = channel as any;
              await gChannel.permissionOverwrites.edit(targetId, {
                Allow: BigInt(ow.allow),
                Deny: BigInt(ow.deny),
              }, 'Liberty City — استعادة أوفررايتس').catch(() => {});
            } catch {}
          }
        }
      } catch (error: any) {
        logger.warn(`Permission overwrites restore failed: ${error.message}`);
      }
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
