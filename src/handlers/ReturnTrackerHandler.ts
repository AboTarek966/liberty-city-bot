// ============================================
// Omni Bot - Return Tracker Handler
// تتبع المغادرة والعودة لكشف تجاوز العقوبات:
// - عند المغادرة: نحفظ الحالة (سجن/كتم/تحذيرات/رولات/آخر عقوبة)
// - عند العودة: نعيد تطبيق العقوبات النشطة تلقائياً + ننبّه الفريق
// ============================================

import { GuildMember, TextChannel, ChannelType, EmbedBuilder } from 'discord.js';
import { OmniClient } from '../OmniClient';
import { createLogger } from '../utils/helpers';
import {
  getGuildSettings,
  MemberReturnRecord,
  JailData,
  MuteRole,
  Warning,
  ModerationCase,
} from '../models';

const logger = createLogger('ReturnTracker');

const WARNING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم
const CASE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 يوم
const EVASION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 ساعة

const CASE_LABELS: Record<string, string> = {
  warn: 'تحذير',
  mute: 'كتم',
  unmute: 'فك كتم',
  timeout: 'تايم أوت',
  untimeout: 'فك تايم أوت',
  kick: 'طرد',
  ban: 'حظر',
  softban: 'حظر ناعم',
};

export class ReturnTrackerHandler {
  private client: OmniClient;

  constructor(client: OmniClient) {
    this.client = client;
  }

  // --------------------------------------------
  // عند المغادرة — حفظ الحالة قبل ضياعها
  // --------------------------------------------
  async onMemberLeave(member: GuildMember): Promise<void> {
    try {
      if (member.user.bot) return;
      const guildId = member.guild.id;
      const userId = member.id;

      const settings = await getGuildSettings(guildId).catch(() => null);
      if ((settings as any)?.protection?.punishmentTracker?.enabled === false) return;

      const since30 = new Date(Date.now() - WARNING_WINDOW_MS);
      const since14 = new Date(Date.now() - CASE_WINDOW_MS);

      const [jail, muteRole, warnings, cases, lastCase] = await Promise.all([
        JailData.findOne({ guildId, userId }).catch(() => null),
        MuteRole.findOne({ guildId }).catch(() => null),
        Warning.countDocuments({ guildId, userId, createdAt: { $gte: since30 } }).catch(() => 0),
        ModerationCase.countDocuments({
          guildId,
          targetId: userId,
          createdAt: { $gte: since14 },
          type: { $in: ['warn', 'mute', 'timeout', 'kick', 'ban', 'softban'] },
        }).catch(() => 0),
        ModerationCase.findOne({ guildId, targetId: userId })
          .sort({ createdAt: -1 })
          .select('type reason createdAt')
          .catch(() => null),
      ]);

      const jailActive =
        !!jail && (!jail.expiresAt || new Date(jail.expiresAt).getTime() > Date.now());

      const currentRoles = member.roles.cache
        .filter((r: any) => r.id !== member.guild.id)
        .map((r: any) => r.id);

      const wasMuted = !!(muteRole && member.roles.cache.has(muteRole.roleId));
      const evasionSuspicion = !!(
        lastCase?.createdAt &&
        Date.now() - new Date(lastCase.createdAt).getTime() < EVASION_WINDOW_MS
      );

      await MemberReturnRecord.findOneAndUpdate(
        { guildId, userId },
        {
          $set: {
            username: member.user.username,
            displayName: member.displayName,
            lastLeaveAt: new Date(),
            lastRoles: currentRoles,
            warnings30d: warnings,
            cases14d: cases,
            lastCaseLabel: lastCase
              ? `${CASE_LABELS[lastCase.type] || lastCase.type}: ${String(lastCase.reason || '').slice(0, 120)}`
              : undefined,
            evasionSuspicion,
            jailSnapshot: jailActive
              ? {
                  roleId: jail!.jailRoleId,
                  channelId: jail!.jailChannelId,
                  reason: jail!.reason,
                  expiresAt: jail!.expiresAt || null,
                }
              : null,
            mutedRoleId: wasMuted ? muteRole!.roleId : null,
          },
          $inc: { leaveCount: 1 },
          $setOnInsert: { firstJoinAt: member.joinedAt || new Date() },
        },
        { upsert: true }
      );

      logger.debug(
        `Leave recorded for ${member.user.tag} (jail=${jailActive}, mute=${wasMuted}, warnings=${warnings}, cases=${cases})`
      );
    } catch (error: any) {
      logger.warn(`onMemberLeave failed: ${error.message}`);
    }
  }

  // --------------------------------------------
  // عند العودة — كشف وإعادة تطبيق العقوبات
  // يُعيد { jailed } حتى يتخطى حدث الدخول الترحيب/الأوتورول
  // --------------------------------------------
  async onMemberJoin(member: GuildMember): Promise<{ jailed: boolean }> {
    const result = { jailed: false };
    try {
      if (member.user.bot) return result;
      const guildId = member.guild.id;
      const userId = member.id;

      const settings = await getGuildSettings(guildId).catch(() => null);
      if ((settings as any)?.protection?.punishmentTracker?.enabled === false) return result;

      const record = await MemberReturnRecord.findOne({ guildId, userId }).catch(() => null);
      if (!record || !record.lastLeaveAt) return result;

      const flags: string[] = [];

      // 1) 🔒 سجن نشط → إعادة تطبيقه كاملاً
      const snap = record.jailSnapshot;
      if (snap?.roleId) {
        const expires = snap.expiresAt ? new Date(snap.expiresAt).getTime() : 0;
        if (!expires || expires > Date.now()) {
          const ok = await this.reapplyJail(member, snap);
          if (ok) {
            result.jailed = true;
            flags.push('🔒 **أُعيد سجنه تلقائياً** — كان مسجوناً قبل مغادرته');
          } else {
            flags.push('⚠️ كان مسجوناً قبل مغادرته — تعذّر إعادة السجن تلقائياً (راجع صلاحيات البوت)');
          }
        }
      }

      // 2) 🔇 كتم نشط → إعادة الرول
      if (record.mutedRoleId) {
        const muteRole = member.guild.roles.cache.get(record.mutedRoleId);
        if (muteRole) {
          const added = await member.roles
            .add(muteRole, 'Omni - إعادة كتم بعد العودة (تجاوز عقوبة)')
            .then(() => true)
            .catch(() => false);
          if (added) flags.push('🔇 **أُعيد كتمه تلقائياً** — كان مكتوماً قبل مغادرته');
        }
      }

      // 3) ⚠️ تحذيرات/إجراءات سابقة → تنبيه
      if (record.warnings30d > 0 || record.cases14d > 0) {
        flags.push(
          `⚠️ سجل سابق: **${record.warnings30d}** تحذير (30 يوم) و **${record.cases14d}** إجراء إشرافي (14 يوم)` +
            (record.lastCaseLabel ? `\n> آخر إجراء: ${record.lastCaseLabel}` : '')
        );
      }

      // 4) 🕵️ عاد خلال 24 ساعة من عقوبة → شبهة تجاوز
      if (record.evasionSuspicion) {
        flags.push('🕵️ **غادر خلال 24 ساعة من عقوبة** — احتمال تجاوز العقوبة');
      }

      // تحديث سجل العودة
      record.rejoinCount += 1;
      record.lastJoinAt = new Date();
      await record.save().catch(() => {});

      if (flags.length) {
        await this.alertStaff(member, record, flags, settings);
      }

      logger.info(
        `Return tracked for ${member.user.tag} — flags=${flags.length} jailed=${result.jailed}`
      );
    } catch (error: any) {
      logger.warn(`onMemberJoin failed: ${error.message}`);
    }
    return result;
  }

  // --------------------------------------------
  // إعادة تطبيق السجن كاملاً (رول + صلاحيات القنوات)
  // --------------------------------------------
  private async reapplyJail(member: GuildMember, snap: any): Promise<boolean> {
    try {
      const guild = member.guild;
      const me = guild.members.me;
      if (!me?.permissions.has('ManageRoles')) return false;

      let jailRole = guild.roles.cache.get(String(snap.roleId));
      if (!jailRole) {
        jailRole = guild.roles.cache.find(
          (r: any) => r.name === '🔒 جايـل' || r.name === 'Jail'
        ) as any;
      }
      if (!jailRole) return false;
      if (me.roles.highest.comparePositionTo(jailRole) <= 0) return false;

      // استبدال كل الرولات برول السجن
      await member.roles.set([jailRole], 'Omni - إعادة سجن تلقائية بعد العودة');

      // منع الرؤية/الكتابة في كل القنوات إلا روم السجن
      const jailChannelId = String(snap.channelId || '');
      const channels = guild.channels.cache.filter(
        (c: any) =>
          c.type === ChannelType.GuildText ||
          c.type === ChannelType.GuildVoice ||
          c.type === ChannelType.GuildCategory
      );

      for (const channel of channels.values()) {
        if ((channel as any).id === jailChannelId) continue;
        await (channel as any).permissionOverwrites
          .edit(
            member,
            { ViewChannel: false, SendMessages: false, Connect: false },
            { reason: 'Omni - إعادة سجن تلقائية' }
          )
          .catch(() => {});
      }

      const jailChannel = jailChannelId ? guild.channels.cache.get(jailChannelId) : null;
      if (jailChannel) {
        await (jailChannel as any).permissionOverwrites
          .edit(
            member,
            {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              AttachFiles: true,
              EmbedLinks: true,
              UseExternalEmojis: true,
              AddReactions: true,
            },
            { reason: 'Omni - إعادة سجن تلقائية' }
          )
          .catch(() => {});
      }

      return true;
    } catch (error: any) {
      logger.warn(`reapplyJail failed: ${error.message}`);
      return false;
    }
  }

  // --------------------------------------------
  // تنبيه الفريق في قناة الحماية/السجلات
  // --------------------------------------------
  private async alertStaff(
    member: GuildMember,
    record: any,
    flags: string[],
    settings: any
  ): Promise<void> {
    try {
      const logId =
        settings?.protection?.logChannel ||
        settings?.logging?.channelId ||
        settings?.protection?.inviteTracker?.logChannel;
      const channel = logId
        ? (member.guild.channels.cache.get(logId) as TextChannel | undefined)
        : null;

      const adminRoles = settings?.tickets?.adminRoleIds?.length
        ? settings.tickets.adminRoleIds
        : settings?.tickets?.supportRoleIds || [];
      const mention = adminRoles.map((r: string) => `<@&${r}>`).join(' ');

      const embed = new EmbedBuilder()
        .setTitle('🔄 عودة عضو — تتبع العقوبات')
        .setColor(flags.some(f => f.includes('أُعيد')) ? 0xe74c3c : 0xf1c40f)
        .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
        .addFields(
          {
            name: '👤 العضو',
            value: `${member.user.tag}\n<@${member.id}> (\`${member.id}\`)`,
            inline: true,
          },
          {
            name: '🚪 آخر مغادرة',
            value: record.lastLeaveAt
              ? `<t:${Math.floor(new Date(record.lastLeaveAt).getTime() / 1000)}:R>`
              : '—',
            inline: true,
          },
          { name: '🔁 عدد العودات', value: String(record.rejoinCount), inline: true },
          { name: '🛡️ ما حدث', value: flags.join('\n').slice(0, 1024), inline: false }
        )
        .setFooter({ text: `${member.guild.name} • Punishment Tracker` })
        .setTimestamp();

      if (channel && channel.isTextBased()) {
        await channel
          .send({
            content: mention || undefined,
            embeds: [embed],
            allowedMentions: { parse: ['roles'] },
          })
          .catch(() => {});
      } else {
        logger.warn(
          `No log channel for return alert in ${member.guild.name} — flags: ${flags.length}`
        );
      }
    } catch (error: any) {
      logger.warn(`alertStaff failed: ${error.message}`);
    }
  }
}

export default ReturnTrackerHandler;
