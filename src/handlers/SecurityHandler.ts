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

export class SecurityHandler {
  private client: Client;

  // تتبّع عمليات الحذف: guildId → { نوع → توقيتات }
  private deletionTracker: Map<string, DeletionTracker> = new Map();

  // مؤقتات النسخ الاحتياطي التلقائي
  private backupTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  cleanup(): void {
    for (const timer of this.backupTimers.values()) clearInterval(timer);
    this.backupTimers.clear();
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
  private async punish(guild: Guild, executor: User, action: 'alert' | 'kick' | 'ban', reason: string): Promise<string> {
    if (executor.id === guild.ownerId) return '⏭️ المالك مستثناً';
    if (executor.id === this.client.user?.id) return '⏭️ البوت مستثنى';

    const member =
      guild.members.cache.get(executor.id) ||
      (await guild.members.fetch(executor.id).catch(() => null));
    if (!member) return '⚠️ المخالف لم يعد عضواً';

    try {
      if (action === 'ban') {
        await member.ban({ reason });
        return '🔨 تم حظر المخالف';
      }
      if (action === 'kick') {
        await member.kick(reason);
        return '👢 تم طرد المخالف';
      }
    } catch (error: any) {
      logger.warn(`punish failed (${action}) in ${guild.name}: ${error.message}`);
      return `⚠️ فشل التنفيذ (${error.message})`;
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
    cfg: { threshold: number; timeWindow: number; action: 'alert' | 'kick' | 'ban' },
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
          name: '🔔 التوصية',
          value: 'إن استُمر الحذف: استخدم `/backup restore` لاستعادة بنية السيرفر من آخر نسخة احتياطية',
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
  async onRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
    try {
      if (!newRole.guild) return;

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
  async restoreBackup(
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
