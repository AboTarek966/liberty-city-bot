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

  // مؤقتات النسخ الاحتياطي التلقائي
  private backupTimers: Map<string, NodeJS.Timeout> = new Map();

  // آخر حالة تسلّم مُبلَّغ عنها لكل سيرفر (ننبّه فقط عند تغيّر الحالة)
  private hierarchyState: Map<string, boolean> = new Map();

  // مؤقتات الاستعادة التلقائية المؤجلة (تُجمَّع عدة حذفات في استعادة واحدة)
  private restoreTimers: Map<string, NodeJS.Timeout> = new Map();

  // 🔒 مقفل استعادة لكل سيرفر — يمنع إنشاء قنوات مكرّرة عند التزامن
  private restoreLocks: Map<string, Promise<{ channels: number; roles: number; skipped: number }>> =
    new Map();

  constructor(client: Client) {
    this.client = client;
  }

  cleanup(): void {
    for (const timer of this.backupTimers.values()) clearInterval(timer);
    this.backupTimers.clear();
    for (const timer of this.restoreTimers.values()) clearTimeout(timer);
    this.restoreTimers.clear();
    this.restoreLocks.clear();
  }

  // --------------------------------------------
  // Helpers
  // --------------------------------------------

  // قناة تنبيهات الأمن: مخصصة → سجلات → نظام → أول قناة قابلة للإرسال
  private async getAlertChannel(guild: Guild, settings: any, specific?: string): Promise<TextChannel | null> {
    const candidates = [
      specific,
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
  private track(guildId: string, type: 'channel' | 'role' | 'ban', windowMs: number): number {
    const now = Date.now();
    let tracker = this.deletionTracker.get(guildId);
    if (!tracker) {
      tracker = { channel: [], role: [], ban: [] };
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

      const settings = await getGuildSettings(guild.id);
      const channel = await this.getAlertChannel(
        guild,
        settings,
        settings?.protection?.antiNuke?.logChannel
      );
      if (!channel) return status;

      // ✅ شُفّت المشكلة — نؤكد للّي صلّحها
      if (status.ok) {
        await channel
          .send({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ إصلاح التسلّم — البوت الآن أعلى رتبة')
                .setDescription(
                  `**${status.botRoleName}** أصبحت أعلى رتبة في السيرفر — الحماية تعمل بالكامل الآن: مضاد النيوك يطرد ويحظر، والاستعادة التلقائية تعمل.`
                )
                .setColor(Colors.success)
                .setFooter({ text: 'Liberty City — Hierarchy Guard' })
                .setTimestamp(),
            ],
          })
          .catch(() => {});
        logger.info(`✅ Hierarchy fixed in ${guild.name}`);
        return status;
      }

      // ❌ مشكلة جديدة → تنبيه عالي الخطورة مع الخطوات
      const lines = status.offenders.length
        ? status.offenders.join('\n')
        : '— (رول غير مُدار أعلى البوت)';

      const embed = new EmbedBuilder()
        .setTitle('🚨 فحص التسلّم — البوت ليس أعلى رتبة!')
        .setDescription(
          '**هذه أخطر ثغرة في حماية السيرفر.**\n' +
          'لو أي أحد فوق البوت، **كل العقوبات تفشل بصمت**: مضاد النيوك ما يقدر يطرد ولا يحظر المخالف، والاستعادة التلقائية قد تتعطّل — والهجوم ينجح بلا مقاومة.'
        )
        .setColor(Colors.error)
        .addFields(
          {
            name: '📌 أعلى رتبة للبوت',
            value: `${status.botRoleName} — الموقع \`#${status.botPosition}\``,
            inline: true,
          },
          {
            name: `⛔ الرولات فوق البوت (${status.offenderCount})`,
            value: lines,
            inline: false,
          },
          {
            name: '🎯 الخطر الحالي',
            value: status.dangerous
              ? '⚠️ **رول فوق البوت يحمل صلاحيات خطيرة** (أدمنستريتر/إدارة/حظر) — أي صاحبه لا يُمسّ.'
              : 'الرولات فوق البوت أدنى خطر، لكنها تمنع معاقبة أصحابها.',
            inline: false,
          },
          {
            name: '✅ الخطوتين للاصلاح',
            value:
              '**1.** افتح Server Settings ← Roles\n' +
              `**2.** اسحب رول البوت (‎${status.botRoleName}‎) **لأعلى القائمة** — يبقى الأول مباشرة تحت @everyone\n\n` +
              '_ملاحظة: من يملك المالك (⭐) يبقى فوق الجميع تلقائياً._',
            inline: false,
          }
        )
        .setFooter({ text: 'Liberty City — Hierarchy Guard' })
        .setTimestamp();

      await channel.send({ embeds: [embed], content: `<@${guild.ownerId}>` }).catch(() => {});
      logger.warn(
        `🚨 Hierarchy: bot NOT top in ${guild.name} | bot=#${status.botPosition} | offenders=${status.offenderCount}`
      );
    } catch (error: any) {
      logger.error(`ensureHierarchyAlert error: ${error.message}`);
    }

    return status;
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
      const threshold = cfg.threshold ?? 3;
      if (count < threshold) return;

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
      const threshold = cfg.threshold ?? 3;
      if (count < threshold) return;

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
      const threshold = cfg.threshold ?? 3;
      if (count < threshold) return;

      this.deletionTracker.get(ban.guild.id)!.ban = [];
      await this.respondMassDeletion(ban.guild, settings, cfg, 'ban', AuditLogEvent.MemberBanAdd, ban.user?.id);
    } catch (error: any) {
      logger.error(`onBanAdd error: ${error.message}`);
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
    type: 'channel' | 'role' | 'ban',
    auditType: AuditLogEvent,
    targetId?: string
  ): Promise<void> {
    const labels = {
      channel: { emoji: '📢', label: 'قنوات' },
      role: { emoji: '🎭', label: 'رولات' },
      ban: { emoji: '🔨', label: 'حظر جماعي' },
    } as const;

    const executor = await this.findExecutor(guild, auditType, targetId);
    const windowSec = Math.round((cfg.timeWindow ?? 10000) / 1000);

    let actionText: string;
    if (executor) {
      actionText = await this.punish(
        guild,
        executor,
        cfg.action ?? 'kick',
        `Liberty City Anti-Nuke: حذف مكثف (${labels[type].label})`
      );
    } else {
      actionText = '⚠️ تعذّر تحديد المنفّذ من سجلات التدقيق';
    }

    const embed = new EmbedBuilder()
      .setTitle(`🚨 تحذير أمني — هجوم حذف مكثف!`)
      .setDescription(
        `${labels[type].emoji} تم حذف **${labels[type].label}** بشكل مكثف خلال ${windowSec} ثانية — هذا نمط هجوم "نيوك" على السيرفر!`
      )
      .setColor(Colors.error)
      .addFields(
        { name: 'المخالف', value: executor ? `${executor} (\`${executor.tag}\`)` : 'غير معروف', inline: true },
        { name: 'الإجراء المتخذ', value: actionText, inline: true },
        {
          name: '🛡️ مستوى تسلّم البوت',
          value: await this.hierarchyField(guild),
          inline: false,
        },
        {
          name: '♻️ التعافي',
          value:
            cfg.autoRestore === false
              ? 'الاستعادة التلقائية **مطفأة** — استخدم `/backup restore` يدوياً لاستعادة البنية'
              : 'جاري الاستعادة التلقائية من آخر نسخة احتياطية…',
          inline: false,
        }
      )
      .setFooter({ text: 'Liberty City Anti-Nuke' })
      .setTimestamp();

    const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
    if (channel) {
      await channel.send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined }).catch(() => {});
    }

    logger.warn(
      `🚨 Anti-Nuke: ${type} x${cfg.threshold} in ${guild.name} | executor=${executor?.tag ?? 'unknown'} | ${actionText}`
    );

    // ♻️ استعادة تلقائية للبنية (قنوات/رولات) — تجاهل الحظر لأنه بنية لا تُستعاد من النسخة
    if (type !== 'ban' && cfg.autoRestore !== false) {
      await this.runAutoRestore(guild, settings, type);
    }
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
      //    (مضاد النيوك + الاستعادة التلقائية + العقوبات تفشل فجأة بلا سبب ظاهر)
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

      const settings = await getGuildSettings(newRole.guild.id);
      const cfg = settings.protection?.antiAdmin;
      if (!cfg?.enabled) return;

      const isEveryone = newRole.id === newRole.guild.id;
      const executor = await this.findExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

      let actionText = '📢 تم الإشعار فقط';
      if (executor && cfg.action === 'kick') {
        actionText = await this.punish(
          newRole.guild,
          executor,
          'kick',
          'Liberty City Anti-Admin: منح صلاحية Administrator بدون إذن'
        );
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚠️ منح صلاحية Administrator${isEveryone ? ' لـ @everyone' : ''}!`)
        .setDescription(
          isEveryone
            ? '**تغيير خطير:** مُنحت صلاحية Administrator لـ @everyone — أي عضو يصبح يملك تحكماً كاملاً في السيرفر!'
            : `مُنحت صلاحية Administrator للرول ${newRole}`
        )
        .setColor(Colors.error)
        .addFields(
          { name: 'المنفّذ', value: executor ? `${executor} (\`${executor.tag}\`)` : 'غير معروف', inline: true },
          { name: 'الإجراء', value: actionText, inline: true },
          {
            name: '🔔 التوصية',
            value: 'راجع الصلاحيات فوراً — إن لم تكن أنت من فعلها، احذف الصلاحية واستخدم `/backup restore` للرولات',
            inline: false,
          }
        )
        .setFooter({ text: 'Liberty City Anti-Admin' })
        .setTimestamp();

      const channel = await this.getAlertChannel(newRole.guild, settings, cfg.logChannel);
      if (channel) await channel.send({ embeds: [embed] }).catch(() => {});

      logger.warn(
        `⚠️ Anti-Admin: Administrator granted to ${isEveryone ? '@everyone' : newRole.name} in ${newRole.guild.name} | ${actionText}`
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

  // إنشاء نسخة احتياطية (بنية القنوات + الرولات)
  async createBackup(guild: Guild): Promise<{ channels: number; roles: number; size: number }> {
    const channels = guild.channels.cache
      .filter(c => !c.isThread())
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
      .filter(r => r.id !== guild.id && !r.managed)
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

    // 1) الرولات أولاً
    for (const rd of data.roles || []) {
      const exists =
        guild.roles.cache.get(rd.id) ||
        guild.roles.cache.find(r => r.name === rd.name && r.id !== guild.id);
      if (exists) {
        result.skipped++;
        continue;
      }
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
      } catch (error: any) {
        logger.warn(`restore role "${rd.name}" failed: ${error.message}`);
        result.skipped++;
      }
      await sleep(700);
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
