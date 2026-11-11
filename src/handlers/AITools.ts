// ============================================
// Omni Bot - AI Tools / Function Calling
// ============================================
// أدوات يستطيع الـ AI استدعاؤها لتنفيذ إجراءات Discord حقيقية

import {
  Client,
  Guild,
  GuildMember,
  User,
  Role,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  GuildVerificationLevel,
  GuildExplicitContentFilter,
  GuildDefaultMessageNotifications,
  AuditLogEvent,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from 'discord.js';
import { OmniClient } from './../OmniClient';
import { getGuildSettings, ModerationCase } from '../models';
import { createLogger } from '../utils/helpers';
import { canManageTarget, isRoleGrantable } from '../utils/rolePicker';

const logger = createLogger('AITools');

// 🔎 حل الرول من ID أو اسم (لما الـ AI يمرّر اسم الرول بدل ID)
function resolveRoleByIdOrName(guild: Guild, input: string | undefined): Role | undefined {
  if (!input) return undefined;
  const raw = String(input).trim();
  const byId = guild.roles.cache.get(raw);
  if (byId) return byId;
  const n = raw.toLowerCase();
  return (
    guild.roles.cache.find(r => r.name.toLowerCase() === n) ||
    guild.roles.cache.find(r => r.name.toLowerCase().includes(n))
  );
}

export interface AIToolResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface ToolContext {
  guild: Guild;
  executor: GuildMember; // العضو اللي طلب (المستخدم)
  client: OmniClient;
  reason?: string;
  /** 🎯 العضو المستهدف افتراضياً (منشن/رد في الرسالة الحالية) */
  defaultTargetUserId?: string;
  /** 📍 القناة الحالية — يستخدمها أي أمر يحتاج channelId تلقائياً */
  defaultChannelId?: string;
  /** 📎 وسائط الرسالة الأصلية — يستخدمها set_server_icon لو الصورة مرفقة بالطلب */
  attachments?: Array<{ url: string; contentType?: string | null; name?: string | null }>;
}

type ToolFunction = (ctx: ToolContext, args: any) => Promise<AIToolResult>;

// --------------------------------------------
// سجل الأدوات المتاحة للـ AI
// --------------------------------------------
const TOOLS: Record<string, {
  func: ToolFunction;
  description: string;
  params: Record<string, { type: string; description: string; required?: boolean }>;
  adminOnly?: boolean;
  dangerous?: boolean;
}> = {};

// Helper لتسجيل الأداة
function registerTool(name: string, tool: typeof TOOLS[string]) {
  TOOLS[name] = tool;
}

// --------------------------------------------
// أدوات الحماية / الإدارة
// --------------------------------------------

registerTool('ban_user', {
  description: 'حظر عضو من السيرفر',
  adminOnly: true,
  dangerous: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو المراد حظره', required: true },
    reason: { type: 'string', description: 'سبب الحظر', required: true },
    deleteMessageSeconds: { type: 'number', description: 'ثواني رسائل تحذف (0-604800)', required: false },
  },
  async func({ guild, executor, client }, { userId, reason, deleteMessageSeconds = 0 }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود في السيرفر' };

    if (!target.bannable) return { success: false, message: '❌ لا أستطيع حظر هذا العضو (رتبته أعلى مني أو لديه صلاحيات)' };
    if (target.id === executor.id) return { success: false, message: '❌ لا تستطيع حظر نفسك' };
    if (target.id === guild.ownerId) return { success: false, message: '❌ لا تستطيع حظر مالك السيرفر' };

    // 🛡️ الجدار الوقائي: أدوات الـ AI أيضاً لا تحظر عند المخالفة الأولى
    if ((client as any)?.securityHandler?.takeStrike?.(guild.id, target.id) === 'first') {
      return { success: false, message: '🛡️ الطبقة الوقائية: مخالفة أولى — لا حظر الآن (تحذير/عزل فقط). حاول مجدداً عند التأكد.' };
    }

    try {
      await target.ban({ reason: `${executor.user.tag}: ${reason}`, deleteMessageSeconds });
      await ModerationCase.create({ guildId: guild.id, userId: target.id, moderatorId: executor.id, type: 'ban', reason });
      return { success: true, message: `🔨 **تم حظر** <@${userId}> (${target.user.tag})`, data: { userId, reason } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحظر: ${e.message}` };
    }
  },
});

registerTool('kick_user', {
  description: 'طرد عضو من السيرفر',
  adminOnly: true,
  dangerous: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو المراد طرده', required: true },
    reason: { type: 'string', description: 'سبب الطرد', required: true },
  },
  async func({ guild, executor, client }, { userId, reason }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود في السيرفر' };
    if (!target.kickable) return { success: false, message: '❌ لا أستطيع طرد هذا العضو' };
    if (target.id === executor.id) return { success: false, message: '❌ لا تستطيع طرد نفسك' };
    if (target.id === guild.ownerId) return { success: false, message: '❌ لا تستطيع طرد مالك السيرفر' };

    // 🛡️ الجدار الوقائي: أدوات الـ AI أيضاً لا تطرد عند المخالفة الأولى
    if ((client as any)?.securityHandler?.takeStrike?.(guild.id, target.id) === 'first') {
      return { success: false, message: '🛡️ الطبقة الوقائية: مخالفة أولى — لا طرد الآن (تحذير/عزل فقط). حاول مجدداً عند التأكد.' };
    }

    try {
      await target.kick(`${executor.user.tag}: ${reason}`);
      await ModerationCase.create({ guildId: guild.id, userId: target.id, moderatorId: executor.id, type: 'kick', reason });
      return { success: true, message: `👢 **تم طرد** <@${userId}> (${target.user.tag})`, data: { userId, reason } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الطرد: ${e.message}` };
    }
  },
});

registerTool('timeout_user', {
  description: 'إعطاء تايم أوت (كتم) لعضو',
  adminOnly: true,
  dangerous: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو', required: true },
    durationMinutes: { type: 'number', description: 'المدة بالدقائق (1-40320 = 28 يوم)', required: true },
    reason: { type: 'string', description: 'السبب', required: true },
  },
  async func({ guild, executor }, { userId, durationMinutes, reason }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود' };
    if (!target.moderatable) return { success: false, message: '❌ لا أستطيع كتم هذا العضو' };
    if (target.id === executor.id) return { success: false, message: '❌ لا تستطيع كتم نفسك' };
    if (target.id === guild.ownerId) return { success: false, message: '❌ لا تستطيع كتم المالك' };

    const ms = Math.min(Math.max(1, durationMinutes), 40320) * 60 * 1000;
    try {
      await target.timeout(ms, `${executor.user.tag}: ${reason}`);
      await ModerationCase.create({ guildId: guild.id, userId: target.id, moderatorId: executor.id, type: 'timeout', reason, duration: ms });
      return { success: true, message: `⏱️ **تم كتم** <@${userId}> لمدة ${durationMinutes} دقيقة`, data: { userId, durationMinutes, reason } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الكتم: ${e.message}` };
    }
  },
});

registerTool('remove_timeout', {
  description: 'إلغاء تايم أوت عضو',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { userId, reason = 'إلغاء تايم أوت' }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود' };
    if (!target.isCommunicationDisabled()) return { success: false, message: 'ℹ️ العضو غير مكتوم أصلاً' };

    try {
      await target.timeout(null, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `🔓 **تم إلغاء كتم** <@${userId}>`, data: { userId } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإلغاء: ${e.message}` };
    }
  },
});

registerTool('warn_user', {
  description: 'إعطاء تحذير لعضو (عداد + رولات تراكمية)',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو', required: true },
    reason: { type: 'string', description: 'السبب', required: true },
  },
  async func({ guild, executor, client }, { userId, reason }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود' };

    try {
      const result = await client.moderationHandler.warn({ guild, moderator: executor, target, reason });
      return { success: true, message: result.simpleMsg, data: { userId, reason } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التحذير: ${e.message}` };
    }
  },
});

registerTool('unwarn_user', {
  description: 'إزالة تحذير واحد + مزامنة رولات',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, client }, { userId, reason = 'إزالة تحذير' }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود' };

    try {
      const result = await client.moderationHandler.unwarn({ guild, moderator: executor, target, reason });
      return { success: true, message: result.simpleMsg, data: { userId } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإزالة: ${e.message}` };
    }
  },
});

// --------------------------------------------
// أدوات القنوات / الرولات
// --------------------------------------------

registerTool('create_channel', {
  description: 'إنشاء قناة نصية/صوتية/فئة/إعلانات/منتدى/ستيج',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'اسم القناة', required: true },
    type: { type: 'string', description: 'text / voice / category / announcement / forum / stage', required: true },
    parentId: { type: 'string', description: 'آيدي/اسم الفئة الأب (اختياري)', required: false },
    topic: { type: 'string', description: 'وصف القناة (للنصية/الإعلانات/المنتدى)', required: false },
    nsfw: { type: 'boolean', description: 'قناة +18؟ (اختياري)', required: false },
    slowmode: { type: 'number', description: 'وضع بطيء بالثواني (0-21600)', required: false },
    userLimit: { type: 'number', description: 'حد أعضاء القناة الصوتية (0-99)', required: false },
    bitrateKbps: { type: 'number', description: 'جودة الصوت بالكيلوبت (8-384)', required: false },
  },
  async func({ guild, client, executor }, { name, type, parentId, topic, nsfw, slowmode, userLimit, bitrateKbps }) {
    const map: Record<string, ChannelType> = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory,
      announcement: ChannelType.GuildAnnouncement,
      forum: ChannelType.GuildForum,
      stage: ChannelType.GuildStageVoice,
    };
    const channelType = map[String(type || 'text').toLowerCase()];
    if (channelType === undefined) return { success: false, message: '❌ النوع: text / voice / category / announcement / forum / stage' };
    const parent = parentId ? resolveChannelByIdOrName(guild, parentId) : null;
    try {
      client.securityHandler?.noteSelfCreatedName(guild.id, 'channel', name);
      const options: any = {
        name: String(name).slice(0, 100),
        type: channelType,
        parent: parent?.id ?? null,
        reason: `${executor.user.tag}: ${name}`,
      };
      if ([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channelType)) {
        if (topic) options.topic = String(topic).slice(0, 1024);
        if (slowmode !== undefined) options.rateLimitPerUser = Math.min(21600, Math.max(0, Math.trunc(Number(slowmode))));
      }
      if ([ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channelType) && nsfw !== undefined) {
        options.nsfw = !!nsfw;
      }
      if (channelType === ChannelType.GuildVoice || channelType === ChannelType.GuildStageVoice) {
        if (userLimit !== undefined) options.userLimit = Math.min(99, Math.max(0, Math.trunc(Number(userLimit))));
        if (bitrateKbps !== undefined && channelType === ChannelType.GuildVoice) {
          options.bitrate = Math.min(384, Math.max(8, Math.trunc(Number(bitrateKbps)))) * 1000;
        }
      }
      const channel = await guild.channels.create(options);
      client.securityHandler?.noteSelfCreated(guild.id, 'channel', channel.id);
      const icon = channelType === ChannelType.GuildVoice ? '🔊' : channelType === ChannelType.GuildCategory ? '📁' : channelType === ChannelType.GuildForum ? '💬' : channelType === ChannelType.GuildStageVoice ? '🎤' : channelType === ChannelType.GuildAnnouncement ? '📣' : '📝';
      return { success: true, message: `✅ **تم إنشاء** ${icon} **${name}**`, data: { channelId: channel.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإنشاء: ${e.message}` };
    }
  },
});

registerTool('delete_channel', {
  description: 'حذف قناة',
  adminOnly: true,
  dangerous: true,
  params: {
    channelId: { type: 'string', description: 'آيدي القناة', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { channelId, reason = 'حذف بواسطة AI' }) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return { success: false, message: '❌ القناة غير موجودة' };

    try {
      await channel.delete(`${executor.user.tag}: ${reason}`);
      return { success: true, message: `🗑️ **تم حذف القناة**`, data: { channelId } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('create_role', {
  description: 'إنشاء رول جديد',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'اسم الرول', required: true },
    color: { type: 'string', description: 'اللون هكس (مثل #ff0000)', required: false },
    hoist: { type: 'boolean', description: 'يظهر منفصلاً في القائمة', required: false },
    mentionable: { type: 'boolean', description: 'قابل للمنشن', required: false },
    permissions: { type: 'string', description: 'بتات الصلاحيات (اختياري)', required: false },
  },
  async func({ guild, client, executor }, { name, color, hoist, mentionable, permissions }) {
    try {
      client.securityHandler?.noteSelfCreatedName(guild.id, 'role', name);
      const role = await guild.roles.create({
        name,
        color: color || '#5865F2',
        hoist: hoist ?? false,
        mentionable: mentionable ?? false,
        permissions: permissions ? BigInt(permissions) : undefined,
        reason: `${executor.user.tag}: ${name}`,
      });
      client.securityHandler?.noteSelfCreated(guild.id, 'role', role.id);
      return { success: true, message: `✅ **تم إنشاء رول** ${role}`, data: { roleId: role.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإنشاء: ${e.message}` };
    }
  },
});

registerTool('delete_role', {
  description: 'حذف رول',
  adminOnly: true,
  dangerous: true,
  params: {
    roleId: { type: 'string', description: 'آيدي الرول', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { roleId, reason = 'حذف بواسطة AI' }) {
    const role = guild.roles.cache.get(roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (role.managed) return { success: false, message: '❌ لا يمكن حذف رول مُدار (بوت/دمج)' };
    if (role.id === guild.id) return { success: false, message: '❌ لا يمكن حذف @everyone' };

    try {
      await role.delete(`${executor.user.tag}: ${reason}`);
      return { success: true, message: `🗑️ **تم حذف الرول**`, data: { roleId } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('give_role', {
  description: 'إعطاء رول لعضو',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو', required: true },
    roleId: { type: 'string', description: 'آيدي الرول', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { userId, roleId, reason = 'إعطاء بواسطة AI' }) {
    const member = await guild.members.fetch(userId).catch(() => null);
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (role.managed) return { success: false, message: '❌ لا يمكن إعطاء رول مُدار' };
    if (!canManageTarget(guild, executor, member)) {
      return { success: false, message: '❌ لا يمكنك إعطاء رول لعضو رتبته أعلى منك أو مساوية لرتبتك' };
    }
    if (!isRoleGrantable(guild, executor, role)) {
      return { success: false, message: '❌ هذا الرول أعلى من رتبتك أو من رتبة البوت' };
    }
    if (member.roles.cache.has(role.id)) return { success: false, message: 'ℹ️ العضو يملك الرول بالفعل' };

    try {
      await member.roles.add(role, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `➕ **أُعطي** <@${userId}> **${role.name}**`, data: { userId, roleId: role.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإعطاء: ${e.message}` };
    }
  },
});

registerTool('remove_role', {
  description: 'إزالة رول من عضو',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو', required: true },
    roleId: { type: 'string', description: 'آيدي الرول', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { userId, roleId, reason = 'إزالة بواسطة AI' }) {
    const member = await guild.members.fetch(userId).catch(() => null);
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!member.roles.cache.has(role.id)) return { success: false, message: 'ℹ️ العضو لا يملك الرول' };
    if (!canManageTarget(guild, executor, member)) {
      return { success: false, message: '❌ لا يمكنك إزالة رول من عضو رتبته أعلى منك أو مساوية لرتبتك' };
    }
    if (!isRoleGrantable(guild, executor, role)) {
      return { success: false, message: '❌ هذا الرول أعلى من رتبتك أو من رتبة البوت' };
    }

    try {
      await member.roles.remove(role, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `➖ **أُزيل** ${role.name} **من** <@${userId}>`, data: { userId, roleId: role.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإزالة: ${e.message}` };
    }
  },
});

// --------------------------------------------
// أدوات الإعدادات / المعلومات
// --------------------------------------------

registerTool('get_server_info', {
  description: 'جلب معلومات شاملة عن السيرفر',
  adminOnly: false,
  params: {},
  async func({ guild }) {
    const settings = await getGuildSettings(guild.id);
    const textCh = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceCh = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const roles = guild.roles.cache.size - 1; // بدون @everyone
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = guild.memberCount - bots;

    return {
      success: true,
      message: `📊 **معلومات السيرفر: ${guild.name}**\n` +
        `👥 الأعضاء: ${guild.memberCount} (بشر: ${humans}، بوتات: ${bots})\n` +
        `📝 قنوات نصية: ${textCh} | 🔊 صوتية: ${voiceCh} | 📁 فئات: ${categories}\n` +
        `🎭 رولات: ${roles}\n` +
        `👑 المالك: <@${guild.ownerId}>\n` +
        `📅 الإنشاء: <t:${Math.floor(guild.createdTimestamp/1000)}:D>\n` +
        `🛡️ الحماية: ${settings.protection.antiNuke?.enabled ? 'مفعلة' : 'معطلة'} | النسخ الاحتياطي: ${settings.protection.autoBackup?.enabled ? 'مفعل' : 'معطل'}`,
      data: { memberCount: guild.memberCount, channels: { text: textCh, voice: voiceCh, categories }, roles },
    };
  },
});

registerTool('get_user_info', {
  description: 'جلب معلومات عضو',
  adminOnly: false,
  params: {
    userId: { type: 'string', description: 'آيدي العضو', required: true },
  },
  async func({ guild }, { userId }) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };

    const roles = member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).join('، ') || 'لا توجد';
    const joined = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp/1000)}:D>` : 'غير معروف';
    const created = `<t:${Math.floor(member.user.createdTimestamp/1000)}:D>`;

    return {
      success: true,
      message: `👤 **معلومات العضو: ${member.user.tag}**\n` +
        `🆔 الآيدي: \`${member.id}\`\n` +
        `📅 انضم: ${joined}\n` +
        `📅 إنشاء الحساب: ${created}\n` +
        `🎭 رولاته: ${roles}\n` +
        `🤖 بوت: ${member.user.bot ? 'نعم' : 'لا'}\n` +
        `⏱️ مكتوم: ${member.isCommunicationDisabled() ? 'نعم' : 'لا'}`,
      data: { userId, roles: member.roles.cache.map(r => r.id), joinedAt: member.joinedTimestamp },
    };
  },
});

registerTool('check_security_status', {
  description: 'فحص حالة الحماية والتسلسل الهرمي',
  adminOnly: true,
  params: {},
  async func({ guild, client }) {
    const securityHandler = client.securityHandler;
    const hierarchy = securityHandler?.checkHierarchy(guild);
    const settings = await getGuildSettings(guild.id);

    let msg = `🛡️ **فحص الأمان للسيرفر: ${guild.name}**\n`;
    if (hierarchy) {
      msg += `\n📌 **التسلسل الهرمي:** ${hierarchy.ok ? '✅ البوت أعلى رتبة' : `❌ ${hierarchy.offenderCount} رول فوق البوت`}`;
      if (!hierarchy.ok && hierarchy.offenders.length) {
        msg += `\nالرولات فوق البوت: ${hierarchy.offenders.slice(0,5).join('، ')}`;
      }
    }
    msg += `\n🔒 **مضاد النيوك:** ${settings.protection.antiNuke?.enabled ? '✅' : '❌'} | الإجراء: ${settings.protection.antiNuke?.action ?? 'kick'}`;
    msg += `\n💾 **نسخ احتياطي:** ${settings.protection.autoBackup?.enabled ? '✅ (كل ' + (settings.protection.autoBackup?.interval ?? 6) + ' ساعة)' : '❌'}`;
    msg += `\n🔍 **فحص دوري:** ${settings.protection.autoScan?.enabled ? '✅ (كل ' + (settings.protection.autoScan?.interval ?? 6) + ' ساعة)' : '❌'}`;
    msg += `\n🤖 **مضاد البوتات:** ${settings.protection.antiBot?.enabled ? '✅' : '❌'}`;
    msg += `\n⚠️ **مراقبة أدمن:** ${settings.protection.antiAdmin?.enabled ? '✅' : '❌'}`;

    return { success: true, message: msg, data: { hierarchy: hierarchy?.ok, antiNuke: settings.protection.antiNuke?.enabled } };
  },
});

registerTool('toggle_protection', {
  description: 'تفعيل/تعطيل ميزة حماية',
  adminOnly: true,
  dangerous: true,
  params: {
    feature: { type: 'string', description: 'الميزة: antiNuke/antiRaid/antiSpam/antiLink/antiInvite/antiMention/antiCaps/antiEmoji/antiBot/antiAdmin/autoBackup/autoScan/scamFilter', required: true },
    enabled: { type: 'boolean', description: 'true للتفعيل / false للتعطيل', required: true },
  },
  async func({ guild, client }, { feature, enabled }) {
    const validFeatures = ['antiNuke','antiRaid','antiSpam','antiLink','antiInvite','antiMention','antiCaps','antiEmoji','antiBot','antiAdmin','autoBackup','autoScan','scamFilter'];
    if (!validFeatures.includes(feature)) {
      return { success: false, message: `❌ ميزة غير معروفة. المتاح: ${validFeatures.join('، ')}` };
    }

    const settings = await getGuildSettings(guild.id);
    const path = `protection.${feature}`;
    const keys = path.split('.');
    let obj: any = settings.protection;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]].enabled = enabled;
    await settings.save();

    // مزامنة المؤقتات
    if (feature === 'autoBackup') {
      await client.securityHandler?.syncAutoBackup(guild, enabled);
    }
    if (feature === 'autoScan') {
      await client.securityHandler?.syncAutoScan(guild);
    }
    if (feature === 'antiNuke') {
      await client.securityHandler?.syncRapidGuard(guild);
    }

    return { success: true, message: `${enabled ? '✅ تم تفعيل' : '❌ تم تعطيل'} **${feature}**`, data: { feature, enabled } };
  },
});

registerTool('create_backup', {
  description: 'إنشاء نسخة احتياطية فورية',
  adminOnly: true,
  params: {},
  async func({ guild, executor, client }) {
    try {
      const result = await client.securityHandler?.createBackup(guild);
      return { success: true, message: `💾 **تم إنشاء نسخة احتياطية:** ${result?.channels ?? 0} قناة، ${result?.roles ?? 0} رول`, data: result };
    } catch (e: any) {
      return { success: false, message: `❌ فشل النسخ: ${e.message}` };
    }
  },
});

registerTool('restore_backup', {
  description: 'استعادة من آخر نسخة احتياطية',
  adminOnly: true,
  dangerous: true,
  params: {},
  async func({ guild, executor, client }) {
    try {
      const result = await client.securityHandler?.restoreBackup(guild);
      return { success: true, message: `♻️ **تمت الاستعادة:** ${result?.channels ?? 0} قناة، ${result?.roles ?? 0} رول`, data: result };
    } catch (e: any) {
      return { success: false, message: `❌ فشلت الاستعادة: ${e.message}` };
    }
  },
});

registerTool('run_security_scan', {
  description: 'تشغيل فحص أمني فوري (يمسح المشبوه + يرجع الناقص)',
  adminOnly: true,
  params: {},
  async func({ guild, executor, client }) {
    try {
      const suspicious = await client.securityHandler?.cleanupSuspicious(guild);
      const result = await client.securityHandler?.restoreBackup(guild);
      return { 
        success: true, 
        message: `🔍 **فحص أمني مكتمل:**\n🧹 مشبوه مُسح: ${suspicious ?? 0}\n♻️ مستعاد: ${result?.channels ?? 0} قناة، ${result?.roles ?? 0} رول`,
        data: { suspicious, restored: result }
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الفحص: ${e.message}` };
    }
  },
});

registerTool('purge_messages', {
  description: 'مسح رسائل من قناة (حتى 100 أو all للكل)',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي القناة', required: true },
    amount: { type: 'number', description: 'عدد الرسائل (1-100)', required: false },
    all: { type: 'boolean', description: 'حذف كل رسائل القناة', required: false },
  },
  async func({ guild, executor }, { channelId, amount = 50, all = false }) {
    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel || !channel.isTextBased()) return { success: false, message: '❌ قناة نصية غير صالحة' };
    if (!('bulkDelete' in channel)) return { success: false, message: '❌ لا يمكن الحذف في هذه القناة' };

    try {
      if (all) {
        let total = 0;
        for (let i = 0; i < 30; i++) {
          const fetched = await channel.messages.fetch({ limit: 100 });
          if (fetched.size === 0) break;
          const deleted = await channel.bulkDelete(fetched, true);
          total += deleted.size;
          if (deleted.size < fetched.size) break;
          await new Promise(r => setTimeout(r, 1200));
        }
        return { success: true, message: `🧹 **تم حذف كل الرسائل** — الإجمالي: ${total} رسالة`, data: { total } };
      }

      const messages = await channel.messages.fetch({ limit: Math.min(100, amount) });
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const toDelete = messages.filter(m => m.createdTimestamp > twoWeeksAgo).first(amount);
      if (toDelete.length === 0) return { success: false, message: '❌ لا توجد رسائل للمسح' };

      const deleted = await channel.bulkDelete(toDelete, true);
      return { success: true, message: `🗑️ **تم مسح ${deleted.size} رسالة**`, data: { count: deleted.size } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل المسح: ${e.message}` };
    }
  },
});

registerTool('send_announcement', {
  description: 'إرسال إعلان لجميع الأعضاء (DM أو قناة)',
  adminOnly: true,
  dangerous: true,
  params: {
    message: { type: 'string', description: 'نص الإعلان', required: true },
    viaDM: { type: 'boolean', description: 'إرسال في الخاص (true) أو في قناة الإعلانات (false)', required: false },
    channelId: { type: 'string', description: 'آيدي القناة (إذا ليس DM)', required: false },
  },
  async func({ guild, executor }, { message, viaDM = false, channelId }) {
    if (viaDM) {
      let sent = 0, failed = 0;
      for (const [, member] of guild.members.cache) {
        if (member.user.bot) continue;
        try {
          await member.send(message);
          sent++;
        } catch { failed++; }
        await new Promise(r => setTimeout(r, 100)); // تجنب rate limit
      }
      return { success: true, message: `📢 **تم الإرسال في الخاص:** نجح ${sent}، فشل ${failed}`, data: { sent, failed } };
    }

    const channel = channelId ? guild.channels.cache.get(channelId) as TextChannel : guild.systemChannel;
    if (!channel || !channel.isTextBased()) return { success: false, message: '❌ قناة غير صالحة' };

    try {
      await channel.send({ content: message });
      return { success: true, message: `📢 **تم الإرسال في** ${channel}`, data: { channelId: channel.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإرسال: ${e.message}` };
    }
  },
});

// --------------------------------------------
// 🖼️ إعدادات السيرفر — تغيير أي شيء يطلبه الأدمن
// --------------------------------------------

function needManageGuild(guild: Guild): AIToolResult | null {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return { success: false, message: '❌ البوت يحتاج صلاحية **تعديل السيرفر (Manage Guild)** — امنحه إياها من إعدادات السيرفر ثم أعد المحاولة' };
  }
  return null;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal as any });
    if (!res.ok) throw new Error(`فشل تحميل الصورة (HTTP ${res.status})`);
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.startsWith('image/') && !url.match(/\.(png|jpe?g|gif|webp)(\?|$)/i)) {
      throw new Error(`الملف ليس صورة (النوع: ${ctype || 'غير معروف'})`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}

function resolveChannelByIdOrName(guild: Guild, input: string | undefined): TextChannel | VoiceChannel | CategoryChannel | null {
  if (!input) return null;
  const raw = String(input).trim();
  const byId = guild.channels.cache.get(raw);
  if (byId) return byId as any;
  const n = raw.toLowerCase().replace(/^#+/, '');
  return (guild.channels.cache.find(c => c.name.toLowerCase() === n) ||
          guild.channels.cache.find(c => c.name.toLowerCase().includes(n)) ||
          null) as any;
}

registerTool('set_server_icon', {
  description: 'تغيير صورة السيرفر — من رابط أو من الصورة المرفقة مع الطلب',
  adminOnly: true,
  params: {
    url: { type: 'string', description: 'رابط الصورة (اختياري — لو الصورة مرفقة بالرسالة لا تكتبه)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, attachments }, { url, reason = 'تغيير الصورة بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const attachmentImage = attachments?.find(a => (a.contentType || '').startsWith('image/'))?.url || attachments?.[0]?.url;
    const src = url || attachmentImage;
    if (!src) return { success: false, message: '❌ مرّر رابط الصورة أو أرفق صورة مع طلبك' };
    try {
      const buffer = await fetchImageBuffer(src);
      await guild.setIcon(buffer, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **تم تغيير صورة السيرفر**`, data: { url: src } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير الصورة: ${e.message}` };
    }
  },
});

registerTool('remove_server_icon', {
  description: 'إزالة صورة السيرفر نهائياً',
  adminOnly: true,
  params: { reason: { type: 'string', description: 'السبب', required: false } },
  async func({ guild, executor }, { reason = 'إزالة الصورة بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    try {
      await guild.setIcon(null, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **تمت إزالة صورة السيرفر**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إزالة الصورة: ${e.message}` };
    }
  },
});

registerTool('set_server_banner', {
  description: 'تغيير البانر (غلاف) السيرفر — يتطلب تعزيز السيرفر',
  adminOnly: true,
  params: {
    url: { type: 'string', description: 'رابط صورة البانر (اختياري — يرفض إن لم يعزّز السيرفر)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, attachments }, { url, reason = 'تغيير البانر بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const attachmentImage = attachments?.find(a => (a.contentType || '').startsWith('image/'))?.url;
    const src = url || attachmentImage;
    if (!src) return { success: false, message: '❌ مرّر رابط البانر أو أرفق صورة مع طلبك' };
    try {
      const buffer = await fetchImageBuffer(src);
      await guild.setBanner(buffer, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **تم تغيير بانر السيرفر**`, data: { url: src } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير البانر: ${e.message} (الغلاف يحتاج تعزيز السيرفر)` };
    }
  },
});

registerTool('remove_server_banner', {
  description: 'إزالة بانر السيرفر',
  adminOnly: true,
  params: { reason: { type: 'string', description: 'السبب', required: false } },
  async func({ guild, executor }, { reason = 'إزالة البانر بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    try {
      await guild.setBanner(null, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **تمت إزالة بانر السيرفر**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إزالة البانر: ${e.message}` };
    }
  },
});

registerTool('set_server_splash', {
  description: 'تغيير خلفية الدعوة (Splash) للسيرفر — يتطلب تعزيز مستوى 1',
  adminOnly: true,
  params: {
    url: { type: 'string', description: 'رابط الصورة (اختياري)', required: false },
    clear: { type: 'boolean', description: 'true لإزالة الخلفية', required: false },
  },
  async func({ guild, executor, attachments }, { url, clear = false }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    try {
      if (clear) {
        await guild.setSplash(null, `${executor.user.tag}: إزالة خلفية الدعوة بواسطة AI`);
        return { success: true, message: '🖼️ **تمت إزالة خلفية الدعوة**' };
      }
      const source = url || attachments?.find(a => (a.contentType || '').startsWith('image/'))?.url;
      if (!source) return { success: false, message: '❌ مرّر رابط صورة أو أرفق صورة' };
      const buffer = await fetchImageBuffer(source);
      await guild.setSplash(buffer, `${executor.user.tag}: خلفية الدعوة بواسطة AI`);
      return { success: true, message: '🖼️ **تم تغيير خلفية الدعوة (Splash)**' };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير الخلفية: ${e.message} (يحتاج تعزيز السيرفر مستوى 1)` };
    }
  },
});

registerTool('rename_server', {
  description: 'تغيير اسم السيرفر',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'الاسم الجديد للسيرفر', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { name, reason = 'تغيير الاسم بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const old = guild.name;
    try {
      await guild.setName(String(name).slice(0, 100), `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **تم تغيير اسم السيرفر** من \`${old}\` إلى \`${String(name).slice(0, 100)}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير الاسم: ${e.message}` };
    }
  },
});

registerTool('set_verification_level', {
  description: 'ضبط مستوى التحقق للأعضاء الجدد (0 لا شيء، 1 منخفض، 2 متوسط، 3 مرتفع، 4 الأعلى)',
  adminOnly: true,
  params: { level: { type: 'number', description: '0-4', required: true } },
  async func({ guild, executor }, { level }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const n = Math.trunc(Number(level));
    if (![0, 1, 2, 3, 4].includes(n)) return { success: false, message: '❌ القيمة بين 0 و 4 فقط' };
    const map: Record<number, GuildVerificationLevel> = { 0: 0 as any, 1: 1 as any, 2: 2 as any, 3: 3 as any, 4: 4 as any };
    try {
      await guild.setVerificationLevel(map[n], `${executor.user.tag}: ضبط مستوى التحقق`);
      return { success: true, message: `✅ **مستوى التحقق الآن:** \`${n}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الضبط: ${e.message}` };
    }
  },
});

registerTool('set_explicit_content_filter', {
  description: 'ضبط فلتر المحتوى الفاحش (0 معطل، 1 للأعضاء بدون رول، 2 للجميع)',
  adminOnly: true,
  params: { filter: { type: 'number', description: '0-2', required: true } },
  async func({ guild, executor }, { filter }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const n = Math.trunc(Number(filter));
    if (![0, 1, 2].includes(n)) return { success: false, message: '❌ القيمة بين 0 و 2 فقط' };
    const map: Record<number, GuildExplicitContentFilter> = { 0: 0 as any, 1: 1 as any, 2: 2 as any };
    try {
      await guild.setExplicitContentFilter(map[n], `${executor.user.tag}: ضبط فلتر المحتوى`);
      return { success: true, message: `✅ **فلتر المحتوى الآن:** \`${n}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الضبط: ${e.message}` };
    }
  },
});

registerTool('set_default_notifications', {
  description: 'ضبط الإشعارات الافتراضية (0 كل الرسائل، 1 الإشارات فقط)',
  adminOnly: true,
  params: { mode: { type: 'number', description: '0 أو 1', required: true } },
  async func({ guild, executor }, { mode }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const n = Math.trunc(Number(mode));
    if (![0, 1].includes(n)) return { success: false, message: '❌ القيمة 0 أو 1 فقط' };
    const map: Record<number, GuildDefaultMessageNotifications> = { 0: 0 as any, 1: 1 as any };
    try {
      await guild.setDefaultMessageNotifications(map[n], `${executor.user.tag}: ضبط الإشعارات`);
      return { success: true, message: `✅ **الإشعارات الافتراضية الآن:** \`${n}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الضبط: ${e.message}` };
    }
  },
});

registerTool('set_system_channel', {
  description: 'تحديد قناة رسائل النظام (الترحيب) — مرر channelId أو اسم القناة، أو null للإزالة',
  adminOnly: true,
  params: {
    channel: { type: 'string', description: 'آيدي/اسم القناة أو null للإزالة', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { channel, reason = 'ضبط قناة النظام بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    if (String(channel).toLowerCase() === 'null') {
      try {
        await guild.setSystemChannel(null, `${executor.user.tag}: ${reason}`);
        return { success: true, message: '✅ **أُزيلت قناة النظام**' };
      } catch (e: any) {
        return { success: false, message: `❌ فشل الإزالة: ${e.message}` };
      }
    }
    const ch = resolveChannelByIdOrName(guild, channel);
    if (!ch || ch.type !== ChannelType.GuildText) return { success: false, message: '❌ قناة نصية غير صالحة' };
    try {
      await guild.setSystemChannel(ch.id, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **قناة النظام الآن:** ${ch}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التحديد: ${e.message}` };
    }
  },
});

registerTool('set_afk_channel', {
  description: 'تحديد قناة AFK والمدة (بالدقائق: 1 أو 5 أو 15 أو 30 أو 60)، أو null للإزالة',
  adminOnly: true,
  params: {
    channel: { type: 'string', description: 'آيدي/اسم القناة الصوتية أو null للإزالة', required: true },
    timeout: { type: 'number', description: 'المدة بالدقائق: 1/5/15/30/60 (اختياري)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { channel, timeout, reason = 'ضبط AFK بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    if (String(channel).toLowerCase() === 'null') {
      try {
        await guild.setAFKChannel(null, `${executor.user.tag}: ${reason}`);
        return { success: true, message: '✅ **أُزيلت قناة AFK**' };
      } catch (e: any) {
        return { success: false, message: `❌ فشل الإزالة: ${e.message}` };
      }
    }
    const ch = resolveChannelByIdOrName(guild, channel);
    if (!ch || ch.type !== ChannelType.GuildVoice) return { success: false, message: '❌ قناة صوتية غير صالحة' };
    try {
      await guild.setAFKChannel(ch.id, `${executor.user.tag}: ${reason}`);
      if (timeout) {
        const valid = [1, 5, 15, 30, 60].find(v => v === Math.trunc(Number(timeout))) ?? 5;
        await guild.setAFKTimeout(valid, `${executor.user.tag}: ${reason}`);
      }
      return { success: true, message: `✅ **قناة AFK الآن:** ${ch}${timeout ? ` — المدة: \`${timeout}\` دقيقة` : ''}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التحديد: ${e.message}` };
    }
  },
});

registerTool('rename_channel', {
  description: 'تغيير اسم قناة أو فئة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة', required: true },
    name: { type: 'string', description: 'الاسم الجديد', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { channelId, name, reason = 'تعديل القناة بواسطة AI' }) {
    const ch = resolveChannelByIdOrName(guild, channelId);
    if (!ch) return { success: false, message: '❌ القناة غير موجودة' };
    try {
      await ch.setName(String(name).slice(0, 100), `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **تم تغيير اسم القناة إلى** \`${String(name).slice(0, 100)}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير الاسم: ${e.message}` };
    }
  },
});

registerTool('set_channel_topic', {
  description: 'تغيير وصف/موضوع قناة نصية',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة النصية', required: true },
    topic: { type: 'string', description: 'الموضوع الجديد (فارغ للمسح)', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { channelId, topic, reason = 'تعديل الموضوع بواسطة AI' }) {
    const ch = resolveChannelByIdOrName(guild, channelId);
    if (!ch || ch.type !== ChannelType.GuildText) return { success: false, message: '❌ قناة نصية غير صالحة' };
    try {
      await (ch as TextChannel).setTopic(String(topic).slice(0, 1024), `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **تم تحديث الموضوع**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تحديث الموضوع: ${e.message}` };
    }
  },
});

registerTool('rename_role', {
  description: 'تغيير اسم رول',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي الرول أو اسمه', required: true },
    name: { type: 'string', description: 'الاسم الجديد', required: true },
    color: { type: 'string', description: 'اللون هكس (اختياري #ff0000)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { roleId, name, color, reason = 'تعديل الرول بواسطة AI' }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (role.managed) return { success: false, message: '❌ لا يمكن تعديل رول مُدار (بوت/دمج)' };
    if (role.id === guild.id) return { success: false, message: '❌ لا يمكن تعديل @everyone' };
    try {
      await role.setName(String(name).slice(0, 100), `${executor.user.tag}: ${reason}`);
      if (color && /^#?[0-9a-fA-F]{6}$/.test(String(color).trim())) {
        await role.setColor((String(color).startsWith('#') ? String(color) : `#${color}`) as any, `${executor.user.tag}: ${reason}`);
      }
      return { success: true, message: `✅ **تم تعديل الرول** ${role}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تعديل الرول: ${e.message}` };
    }
  },
});

registerTool('create_invite', {
  description: 'إنشاء رابط دعوة جديد في قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة', required: true },
    maxAge: { type: 'number', description: 'المدة بالثواني (0 = لا تنتهي) — مثال 86400', required: false },
    maxUses: { type: 'number', description: 'عدد الاستخدامات (0 = بلا حد)', required: false },
    temporary: { type: 'boolean', description: 'دعوة مؤقتة؟', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { channelId, maxAge = 0, maxUses = 0, temporary = false, reason = 'دعوة بواسطة AI' }) {
    const ch = resolveChannelByIdOrName(guild, channelId);
    if (!ch) return { success: false, message: '❌ القناة غير موجودة' };
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
      return { success: false, message: '❌ البوت يحتاج صلاحية **إنشاء دعوات (Create Instant Invite)** للقناة' };
    }
    try {
      const invite = await (ch as TextChannel).createInvite({ maxAge: Math.max(0, Math.trunc(maxAge)), maxUses: Math.max(0, Math.trunc(maxUses)), temporary, reason: `${executor.user.tag}: ${reason}` });
      return { success: true, message: `✅ **تم إنشاء الدعوة:** ${invite.url}`, data: { url: invite.url } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء الدعوة: ${e.message}` };
    }
  },
});

registerTool('delete_all_invites', {
  description: 'حذف كل دعوات السيرفر',
  adminOnly: true,
  dangerous: true,
  params: { reason: { type: 'string', description: 'السبب', required: false } },
  async func({ guild, executor }, { reason = 'تنظيف الدعوات بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    try {
      const invites = await guild.invites.fetch();
      const list = invites.map(i => i);
      for (const invite of list) {
        await invite.delete(`${executor.user.tag}: ${reason}`).catch(() => null);
      }
      return { success: true, message: `🧹 **تم حذف ${list.length} دعوة**`, data: { count: list.length } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل حذف الدعوات: ${e.message}` };
    }
  },
});

registerTool('prune_members', {
  description: 'حذف الأعضاء غير النشطين (لا يملكون رول وبدون نشاط خلال X يوم)',
  adminOnly: true,
  dangerous: true,
  params: {
    days: { type: 'number', description: 'أيام عدم النشاط (1-30)', required: true },
    computeCount: { type: 'boolean', description: 'احسب فقط بدون حذف (true = تجربة)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { days, computeCount = false, reason = 'حذف غير النشط بواسطة AI' }) {
    const n = Math.min(30, Math.max(1, Math.trunc(Number(days))));
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) {
      return { success: false, message: '❌ البوت يحتاج صلاحية **طرد الأعضاء (Kick Members)**' };
    }
    try {
      // dry: true = احسب فقط بدون حذف — يرجّع عدد الأعضاء المطابقين
      const result: any = await (guild.members as any).prune(
        computeCount ? { days: n, dry: true, reason: `${executor.user.tag}: ${reason}` } : { days: n, reason: `${executor.user.tag}: ${reason}` }
      );
      const count = typeof result === 'number' ? result : (result?.pruned ?? result?.count ?? 0);
      return { success: true, message: computeCount ? `📊 **سيُحذف ${count} عضو غير نشط**` : `🧹 **تم حذف ${count} عضو غير نشط**`, data: { count } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

// ============================================
// 🧰 مهارات واسعة جداً — ينفذها الـ AI بطلب الإدارة فقط
// ============================================

// قاموس صلاحيات ديسكورد — يُبنى من إحصائيات lib نفسه (يغطي كل الصلاحيات تلقائياً)
const PERM_LOOKUP = new Map<string, { name: string; bit: bigint }>();
for (const [name, bit] of Object.entries(PermissionFlagsBits as any)) {
  PERM_LOOKUP.set(String(name).toLowerCase().replace(/[_\s-]+/g, ''), { name, bit: bit as bigint });
}
const ARABIC_PERM_ALIAS: Record<string, string> = {
  'حظر': 'BanMembers', 'طرد': 'KickMembers', 'كتم': 'ModerateMembers', 'ادمن': 'Administrator',
  'وومنشن': 'MentionEveryone', 'علاقات': 'ManageRoles', 'رولات': 'ManageRoles', 'قنوات': 'ManageChannels',
  'رسائل': 'SendMessages', 'إرسال': 'SendMessages', 'عرض': 'ViewChannel', 'الكتب': 'AttachFiles',
  'روابط': 'EmbedLinks', 'إيموجيات': 'UseExternalEmojis', 'نشر': 'Stream', 'صوت': 'Connect',
  'تكلم': 'Speak', 'اعجاب': 'AddReactions', 'تثبيت': 'ManageMessages', 'مهام': 'ManageWebhooks',
};
function resolvePerm(input: string): { name: string; bit: bigint } | null {
  const norm = String(input).toLowerCase().replace(/[_\s-]+/g, '');
  if (PERM_LOOKUP.has(norm)) return PERM_LOOKUP.get(norm)!;
  const alias = ARABIC_PERM_ALIAS[String(input).trim()];
  if (alias) {
    const n2 = alias.toLowerCase().replace(/[_\s-]+/g, '');
    return PERM_LOOKUP.get(n2) ?? null;
  }
  return null;
}
function parsePermList(v: any): { perms: { name: string; bit: bigint }[]; unknown: string[] } {
  const raw = Array.isArray(v) ? v : String(v ?? '').split(',');
  const perms: { name: string; bit: bigint }[] = [];
  const unknown: string[] = [];
  for (const item of raw) {
    const t = String(item).trim();
    if (!t) continue;
    const p = resolvePerm(t);
    if (p) perms.push(p); else unknown.push(t);
  }
  return { perms, unknown };
}

function canEditRole(guild: Guild, executor: GuildMember, role: Role): boolean {
  if (role.id === guild.id) return false;
  if (role.managed) return false;
  const isOwner = executor.id === guild.ownerId;
  const isAdmin = executor.permissions.has(PermissionFlagsBits.Administrator);
  const myPos = guild.members.me?.roles.highest.position ?? 0;
  if (!isOwner && !isAdmin && executor.roles.highest.position <= role.position) return false;
  if (myPos <= role.position) return false;
  return true;
}

function overwriteKey(p: { name: string }): string { return p.name; }

registerTool('set_slowmode', {
  description: 'ضبط سلو موود (الحد الأدنى لفاصل الرسائل) لقناة نصية',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    seconds: { type: 'number', description: 'الثواني بين كل رسالتين (0-21600)', required: true },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, seconds }) {
    const targetId = channelId ?? defaultChannelId;
    const ch = (targetId ? guild.channels.cache.get(String(targetId)) : null) as TextChannel | undefined;
    const channel = ch && ch.type === ChannelType.GuildText ? ch
      : resolveChannelByIdOrName(guild, targetId) as TextChannel | null;
    if (!channel || channel.type !== ChannelType.GuildText) return { success: false, message: '❌ قناة نصية غير صالحة' };
    const secs = Math.min(21600, Math.max(0, Math.trunc(Number(seconds))));
    try {
      await (channel as any).setRateLimitPerUser?.(secs, `${executor.user.tag}: slowmode بواسطة AI`);
      return { success: true, message: `⏱️ **سلو موود الآن ${secs} ثانية في** ${channel}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل ضبط السلو موود: ${e.message}` };
    }
  },
});

registerTool('set_voice_limit', {
  description: 'ضبط الحد الأقصى للأعضاء في قناة صوتية',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    limit: { type: 'number', description: 'الحد الأقصى (0 = بلا حدود)', required: true },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, limit }) {
    const targetId = channelId ?? defaultChannelId;
    const ch = (targetId ? guild.channels.cache.get(String(targetId)) : null) as any;
    const channel = ch && ch.type === ChannelType.GuildVoice ? ch
      : (resolveChannelByIdOrName(guild, targetId) as any);
    if (!channel || channel.type !== ChannelType.GuildVoice) return { success: false, message: '❌ قناة صوتية غير صالحة' };
    const n = Math.min(99, Math.max(0, Math.trunc(Number(limit))));
    try {
      await channel.setUserLimit(n, `${executor.user.tag}: حد الأعضاء بواسطة AI`);
      return { success: true, message: `🔊 **حد أعضاء** ${channel} **الآن: ${n}**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل ضبط الحد: ${e.message}` };
    }
  },
});

registerTool('move_channel', {
  description: 'نقل قناة/فئة إلى فئة أخرى أو تغيير ترتيبها',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    categoryId: { type: 'string', description: 'آيدي/اسم الفئة المنقول إليها (اختياري)', required: false },
    position: { type: 'number', description: 'الترتيب الجديد (اختياري)', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, categoryId, position }) {
    const targetId = channelId ?? defaultChannelId;
    const channel = resolveChannelByIdOrName(guild, targetId);
    if (!channel) return { success: false, message: '❌ القناة غير موجودة' };
    try {
      if (categoryId !== undefined && categoryId !== null && String(categoryId).toLowerCase() !== 'none') {
        const cat = resolveChannelByIdOrName(guild, categoryId) as any;
        const catId = cat?.type === ChannelType.GuildCategory ? cat.id
          : guild.channels.cache.get(String(categoryId))?.id;
        if (!catId) return { success: false, message: '❌ الفئة غير موجودة' };
        await channel.setParent(catId, { reason: `${executor.user.tag}: نقل بواسطة AI`, lockPermissions: false });
      }
      if (position !== undefined && position !== null) {
        await channel.setPosition(Math.trunc(Number(position)), { reason: `${executor.user.tag}: ترتيب بواسطة AI` } as any);
      }
      return { success: true, message: `✅ **تم نقل/ترتيب** ${channel}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل النقل: ${e.message}` };
    }
  },
});

registerTool('set_nsfw', {
  description: 'تحديد/إزالة علامة NSFW لقناة نصية',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    enabled: { type: 'boolean', description: 'true للتفعيل / false للإزالة', required: true },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, enabled }) {
    const targetId = channelId ?? defaultChannelId;
    const channel = resolveChannelByIdOrName(guild, targetId) as TextChannel | null;
    if (!channel || channel.type !== ChannelType.GuildText) return { success: false, message: '❌ قناة نصية غير صالحة' };
    try {
      await (channel as any).setNSFW?.(!!enabled, `${executor.user.tag}: NSFW بواسطة AI`);
      return { success: true, message: enabled ? `🔞 **أُضيفت علامة NSFW** على ${channel}` : `✅ **أُزيلت علامة NSFW** من ${channel}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الضبط: ${e.message}` };
    }
  },
});

registerTool('pin_last_message', {
  description: 'تثبيت آخر رسالة في قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { channelId }) {
    const targetId = channelId ?? defaultChannelId;
    const channel = resolveChannelByIdOrName(guild, targetId) as TextChannel | null;
    if (!channel || !channel.isTextBased()) return { success: false, message: '❌ قناة نصية غير صالحة' };
    try {
      const messages = await (channel as TextChannel).messages.fetch({ limit: 1 });
      const last = messages.first();
      if (!last) return { success: false, message: '❌ لا توجد رسائل للتثبيت' };
      await last.pin(`${executor.user.tag}: تثبيت بواسطة AI`);
      return { success: true, message: `📌 **تم تثبيت آخر رسالة** في ${channel}`, data: { messageId: last.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التثبيت: ${e.message}` };
    }
  },
});

registerTool('send_dm', {
  description: 'إرسال رسالة خاصة (DM) لعضو',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي/منشن العضو (لو مفيش — الهدف في الرسالة)', required: false },
    message: { type: 'string', description: 'نص الرسالة', required: true },
  },
  async func({ guild, executor, defaultTargetUserId }, { userId, message }) {
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه في الرسالة' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    try {
      await member.send(String(message).slice(0, 1900));
      return { success: true, message: `📩 **تم الإرسال إلى** ${member.user.tag}` };
    } catch {
      return { success: false, message: '❌ تعذّر الإرسال الخاص (ربما أغلق الفياضي)' };
    }
  },
});

registerTool('set_role_permissions', {
  description: 'إضافة/إزالة صلاحيات لرول (add, remove) — من آيدي أو اسم الرول',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي الرول أو اسمه', required: true },
    add: { type: 'array', description: 'صلاحيات تُضاف (مثل ["SendMessages","ManageChannels"]) — مصفوفة من السلاسل', required: false },
    remove: { type: 'array', description: 'صلاحيات تُزال — مصفوفة من السلاسل', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { roleId, add, remove, reason = 'تعديل صلاحيات بواسطة AI' }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!canEditRole(guild, executor, role)) return { success: false, message: '❌ لا يمكنك تعديل هذا الرول (الرتبة أو @everyone أو رول مُدار)' };
    const added = parsePermList(add);
    const removed = parsePermList(remove);
    const unknown = [...added.unknown, ...removed.unknown];
    if (unknown.length) return { success: false, message: `❌ صلاحيات غير معروفة: ${unknown.join('، ')}` };
    try {
      let bits = role.permissions.bitfield as any as bigint;
      for (const p of added.perms) bits = (bits | p.bit) as any as bigint;
      for (const p of removed.perms) bits = (bits & ~p.bit) as any as bigint;
      await role.setPermissions(bits, `${executor.user.tag}: ${reason}`);
      const listOf = (xs: { name: string }[]) => xs.map(x => x.name).join('، ') || '—';
      return { success: true, message: `✅ **عُدّلت صلاحيات** ${role}\n> ➕ ${listOf(added.perms)}\n> ➖ ${listOf(removed.perms)}`, data: { roleId: role.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التعديل (قد يكون الرول أعلى من رتبتي): ${e.message}` };
    }
  },
});

registerTool('set_channel_permissions', {
  description: 'تعديل صلاحيات هدف (رول/عضو/الجميع) على قناة — allow و deny بقائمة صلاحيات',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    target: { type: 'string', description: "آيدي/اسم رول أو عضو، أو 'everyone'", required: true },
    allow: { type: 'array', description: 'صلاحيات تُمنح — مصفوفة من السلاسل', required: false },
    deny: { type: 'array', description: 'صلاحيات تُمنع — مصفوفة من السلاسل', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, target, allow, deny, reason = 'تعديل صلاحيات القناة بواسطة AI' }) {
    const targetId = channelId ?? defaultChannelId;
    const channel = resolveChannelByIdOrName(guild, targetId) as TextChannel | null;
    if (!channel) return { success: false, message: '❌ القناة غير موجودة' };

    const added = parsePermList(allow);
    const removed = parsePermList(deny);
    const unknown = [...added.unknown, ...removed.unknown];
    if (unknown.length) return { success: false, message: `❌ صلاحيات غير معروفة: ${unknown.join('، ')}` };

    let overwriteTarget: any;
    const t = String(target).trim();
    if (/^everyone$/i.test(t) || t === String(guild.id)) {
      overwriteTarget = guild.id;
    } else {
      const asRole = resolveRoleByIdOrName(guild, t);
      if (asRole) overwriteTarget = asRole;
      else {
        const asMember = guild.members.cache.get(t) ||
          guild.members.cache.find(m => m.user.username.toLowerCase() === t.toLowerCase() || m.displayName.toLowerCase() === t.toLowerCase());
        if (asMember) overwriteTarget = asMember;
        else return { success: false, message: '❌ لم أجد رول/عضو بهذا الاسم أو ID' };
      }
    }

    const overwrite: Record<string, boolean> = {};
    for (const p of added.perms) overwrite[overwriteKey(p)] = true;
    for (const p of removed.perms) overwrite[overwriteKey(p)] = false;
    if (!Object.keys(overwrite).length) return { success: false, message: '❌ حدد صلاحيات (allow أو deny)' };

    try {
      await (channel as any).permissionOverwrites.edit(overwriteTarget, overwrite, { reason: `${executor.user.tag}: ${reason}` });
      const list = Object.entries(overwrite).map(([k, v]) => `${v ? '✅' : '❌'} ${k}`).join('، ');
      return { success: true, message: `✅ **تم تعديل صلاحيات ${channel}** لـ ${overwriteTarget === guild.id ? '@everyone' : overwriteTarget}\n${list}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التعديل: ${e.message}` };
    }
  },
});

registerTool('rename_member', {
  description: 'تغيير اسم عضو في السيرفر (آيدي/منشن/اسم — لو مش محدد: الهدف المُمنشن/المردود)',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو (اختياري)', required: false },
    nickname: { type: 'string', description: 'الاسم الجديد (فارغ للمسح)', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultTargetUserId }, { userId, nickname, reason = 'تغيير الاسم بواسطة AI' }) {
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (member.id === guild.ownerId) return { success: false, message: '❌ لا يمكن تغيير اسم المالك' };
    if (member.roles.highest.position >= (guild.members.me?.roles.highest.position ?? 0)) {
      return { success: false, message: '❌ رتبة العضو أعلى من رتبتي' };
    }
    try {
      await member.setNickname(String(nickname).slice(0, 32) || null, `${executor.user.tag}: ${reason}`);
      return { success: true, message: nickname ? `✅ **تم تغيير اسم** ${member.user.tag} **إلى** \`${String(nickname).slice(0, 32)}\`` : `✅ **تمت إزالة اسم** ${member.user.tag}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير الاسم: ${e.message}` };
    }
  },
});

registerTool('create_thread', {
  description: 'إنشاء ثريد (نقاش) في قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    name: { type: 'string', description: 'اسم الثريد', required: true },
    autoArchiveMinutes: { type: 'number', description: 'دقائق حتى الأرشفة التلقائية (60/1440/4320/10080)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, name, autoArchiveMinutes = 1440, reason = 'ثريد بواسطة AI' }) {
    const targetId = channelId ?? defaultChannelId;
    const channel = resolveChannelByIdOrName(guild, targetId) as TextChannel | null;
    if (!channel || channel.type !== ChannelType.GuildText) return { success: false, message: '❌ قناة نصية غير صالحة (أو قناة لا تدعم الثريد)' };
    const valid = [60, 1440, 4320, 10080];
    const mins = valid.includes(Math.trunc(Number(autoArchiveMinutes))) ? Math.trunc(Number(autoArchiveMinutes)) : 1440;
    try {
      const thread = await (channel as any).threads.create({ name: String(name).slice(0, 100), autoArchiveDuration: mins, reason: `${executor.user.tag}: ${reason}` });
      return { success: true, message: `🧵 **تم إنشاء الثريد** ${thread}`, data: { threadId: thread.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء الثريد: ${e.message}` };
    }
  },
});

registerTool('set_bot_nickname', {
  description: 'تغيير كنية البوت داخل السيرفر',
  adminOnly: true,
  params: {
    nickname: { type: 'string', description: 'الكنية الجديدة (فارغ للمسح)', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { nickname, reason = 'كنية البوت بواسطة AI' }) {
    try {
      await guild.members.me?.setNickname(String(nickname).slice(0, 32) || null, `${executor.user.tag}: ${reason}`);
      return { success: true, message: nickname ? `✅ **تم ضبط كنية البوت إلى** \`${String(nickname).slice(0, 32)}\`` : '✅ **أُزيلت كنية البوت**' };
    } catch (e: any) {
      return { success: false, message: `❌ فشل ضبط الكنية: ${e.message}` };
    }
  },
});

registerTool('move_member_voice', {
  description: 'نقل عضو من قناة صوتية إلى أخرى (آيدي/منشن — لو مش محدد: الهدف المُمنشن/المردود)',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو (اختياري)', required: false },
    channelId: { type: 'string', description: 'آيدي/اسم القناة الصوتية المنقول إليها', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultTargetUserId }, { userId, channelId, reason = 'نقل صوتي بواسطة AI' }) {
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!member.voice?.channel) return { success: false, message: '❌ العضو ليس داخل قناة صوتية' };
    const dest = resolveChannelByIdOrName(guild, channelId) as any;
    const destId = dest && dest.type === ChannelType.GuildVoice ? dest.id : guild.channels.cache.get(String(channelId))?.id;
    if (!destId) return { success: false, message: '❌ قناة صوتية غير صالحة' };
    try {
      await member.voice.setChannel(destId, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `✅ **نُقل** ${member.user.tag} **إلى** <#${destId}>` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل النقل: ${e.message}` };
    }
  },
});

registerTool('cleanup_webhooks', {
  description: 'حذف كل الويب هوكس في قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, reason = 'تنظيف الويب هوكس بواسطة AI' }) {
    const targetId = channelId ?? defaultChannelId;
    const channel = resolveChannelByIdOrName(guild, targetId) as any;
    if (!channel) return { success: false, message: '❌ القناة غير موجودة' };
    try {
      const hooks = await channel.fetchWebhooks?.();
      const list = hooks && typeof hooks.values === 'function' ? [...hooks.values()] : (Array.isArray(hooks) ? hooks : []);
      for (const hook of list) await hook.delete(`${executor.user.tag}: ${reason}`).catch(() => null);
      return { success: true, message: `🧹 **تم حذف ${list.length} ويب هوك** من ${channel}`, data: { count: list.length } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل: ${e.message}` };
    }
  },
});

registerTool('giveaway_create', {
  description: 'إنشاء سحب (Giveaway) في قناة',
  adminOnly: true,
  params: {
    prize: { type: 'string', description: 'الجائزة', required: true },
    durationMinutes: { type: 'number', description: 'المدة بالدقائق (مثال: 60 = ساعة)', required: false },
    winners: { type: 'number', description: 'عدد الفائزين (1-10)', required: false },
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    description: { type: 'string', description: 'وصف إضافي', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { prize, durationMinutes = 60, winners = 1, channelId, description }) {
    const { createGiveaway, buildGiveawayPayload, scheduleGiveaway } = await import('../utils/giveaway');
    const targetId = channelId ?? defaultChannelId;
    const ch = resolveChannelByIdOrName(guild, targetId) as TextChannel | null;
    const channel = ch && ch.type === ChannelType.GuildText ? ch : null;
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة للسحب' };
    try {
      const giveaway = await createGiveaway({
        guildId: guild.id,
        channelId: channel.id,
        hostId: executor.id,
        prize: String(prize).slice(0, 200),
        description: String(description || '').slice(0, 1000),
        winnersCount: Math.min(10, Math.max(1, Math.trunc(Number(winners)))),
        durationMs: Math.max(10_000, Math.trunc(Number(durationMinutes) * 60_000)),
        requirements: {},
      });
      const payload = buildGiveawayPayload(giveaway, {}, guild.name);
      const message = await channel.send({ embeds: payload.embeds, components: payload.components });
      giveaway.messageId = message.id;
      await giveaway.save();
      const { Giveaway } = await import('../models');
      void Giveaway; // تم الحفظ عبر giveaway.save()
      scheduleGiveaway(executor.client as any, giveaway);
      return { success: true, message: `🎁 **تم إنشاء السحب** ${channel}\n> المعرّف: \`${giveaway.shortId}\` — ينتهي خلال \`${durationMinutes}\` دقيقة — الفائزون: ${winners}`, data: { shortId: giveaway.shortId } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء السحب: ${e.message}` };
    }
  },
});

registerTool('close_current_ticket', {
  description: 'إغلاق التذكرة الحالية (التذكرة اللي في القناة دي) بالسبب',
  adminOnly: true,
  params: {
    reason: { type: 'string', description: 'سبب الإغلاق', required: false },
  },
  async func({ guild, executor, defaultChannelId, client }, { reason }) {
    const { default: Ticket } = await import('../models').then(m => ({ default: (m as any).Ticket }));
    const channelId = defaultChannelId || '';
    if (!channelId) return { success: false, message: '❌ هذه القناة ليست تذكرة' };
    const ticket = await Ticket.findOne({ guildId: guild.id, channelId, status: { $in: ['open', 'claimed', 'waiting'] } });
    if (!ticket) return { success: false, message: '❌ هذه ليست قناة تذكرة مفتوحة' };
    try {
      await (client as any).ticketHandler.closeTicket(channelId, executor, reason || 'إغلاق عبر AI من داخل التذكرة');
      return { success: true, message: '🔒 **تم إغلاق التذكرة**' };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإغلاق: ${e.message}` };
    }
  },
});


// ============================================
// 🚀 قدرات موسّعة — رسائل، ثريدات، قنوات، رولات، أعضاء، سيرفر، إيموجي، ويب هوك، أحداث، أوتومود، موسيقى، تذاكر
// ============================================

function needBotPerm(guild: Guild, perm: bigint, label: string): AIToolResult | null {
  if (!guild.members.me?.permissions.has(perm)) {
    return { success: false, message: `❌ البوت يحتاج صلاحية **${label}** — امنحه إياها ثم أعد المحاولة` };
  }
  return null;
}

function resolveTextChannelSafe(guild: Guild, input?: string): any | null {
  const ch = resolveChannelByIdOrName(guild, input);
  return ch && (ch as any).isTextBased?.() ? ch : null;
}

function resolveThreadSafe(guild: Guild, input: string): any | null {
  const raw = String(input || '').trim();
  const byId = guild.channels.cache.get(raw);
  if (byId && (byId as any).isThread?.()) return byId;
  const n = raw.toLowerCase();
  return guild.channels.cache.find(c => (c as any).isThread?.() && c.name.toLowerCase().includes(n)) || null;
}

async function resolveMessageSafe(channel: any, messageId?: string): Promise<any | null> {
  if (!messageId || /^(last|latest|الأخير|الاخير|آخر)$/i.test(String(messageId).trim())) {
    const msgs = await channel.messages.fetch({ limit: 1 });
    return msgs.first() || null;
  }
  return channel.messages.fetch(String(messageId)).catch(() => null);
}

function parseHexColor(input: any): number | null {
  if (input === undefined || input === null || String(input).trim() === '') return null;
  const s = String(input).trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return parseInt(s, 16);
}

function resolveEmojiSafe(guild: Guild, input: string): any | null {
  const raw = String(input || '').trim().replace(/^:|:$/g, '');
  const byId = guild.emojis.cache.get(raw);
  if (byId) return byId;
  const n = raw.toLowerCase();
  return guild.emojis.cache.find(e => e.name?.toLowerCase() === n) ||
         guild.emojis.cache.find(e => e.name?.toLowerCase().includes(n)) || null;
}

function sameVoiceChannel(guild: Guild, member: GuildMember): boolean {
  const me = guild.members.me;
  return !!member.voice?.channelId && member.voice.channelId === me?.voice?.channelId;
}

// --------------------------------------------
// 💬 رسائل / ثريدات
// --------------------------------------------

registerTool('send_message', {
  description: 'إرسال رسالة نصية في أي قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    content: { type: 'string', description: 'نص الرسالة', required: true },
    replyToMessageId: { type: 'string', description: 'آيدي رسالة للرد عليها (اختياري)', required: false },
  },
  async func({ guild, defaultChannelId }, { channelId, content, replyToMessageId }) {
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة' };
    try {
      const payload: any = { content: String(content).slice(0, 2000) };
      if (replyToMessageId) payload.reply = { messageId: String(replyToMessageId), failIfNotExists: false };
      const msg = await channel.send(payload);
      return { success: true, message: `📨 **تم إرسال الرسالة في** ${channel}`, data: { messageId: msg.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإرسال: ${e.message}` };
    }
  },
});

registerTool('send_embed', {
  description: 'إرسال رسالة بتصميم (Embed) في قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: القناة الحالية)', required: false },
    title: { type: 'string', description: 'العنوان (اختياري)', required: false },
    description: { type: 'string', description: 'النص الأساسي', required: true },
    color: { type: 'string', description: 'اللون هكس مثل #5865F2 (اختياري)', required: false },
    imageUrl: { type: 'string', description: 'رابط صورة داخل الإيمبد (اختياري)', required: false },
    footer: { type: 'string', description: 'نص التذييل (اختياري)', required: false },
  },
  async func({ guild, defaultChannelId }, { channelId, title, description, color, imageUrl, footer }) {
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة' };
    try {
      const embed = new EmbedBuilder()
        .setDescription(String(description).slice(0, 4000))
        .setColor((parseHexColor(color) ?? Colors.Blurple) as any);
      if (title) embed.setTitle(String(title).slice(0, 256));
      if (imageUrl) embed.setImage(String(imageUrl));
      if (footer) embed.setFooter({ text: String(footer).slice(0, 2048) });
      const msg = await channel.send({ embeds: [embed] });
      return { success: true, message: `🎨 **تم إرسال الإيمبد في** ${channel}`, data: { messageId: msg.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإرسال: ${e.message}` };
    }
  },
});

registerTool('delete_message', {
  description: 'حذف رسالة محددة (آيدي أو last لآخر رسالة)',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: الحالية)', required: false },
    messageId: { type: 'string', description: 'آيدي الرسالة أو last', required: true },
  },
  async func({ guild, defaultChannelId }, { channelId, messageId }) {
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة' };
    const msg = await resolveMessageSafe(channel, messageId);
    if (!msg) return { success: false, message: '❌ الرسالة غير موجودة' };
    try {
      await msg.delete();
      return { success: true, message: `🗑️ **تم حذف الرسالة** في ${channel}`, data: { messageId: msg.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('edit_message', {
  description: 'تعديل رسالة من رسائل البوت (آيدي أو last)',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: الحالية)', required: false },
    messageId: { type: 'string', description: 'آيدي الرسالة أو last', required: true },
    content: { type: 'string', description: 'النص الجديد', required: true },
  },
  async func({ guild, client, defaultChannelId }, { channelId, messageId, content }) {
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة' };
    const msg = await resolveMessageSafe(channel, messageId);
    if (!msg) return { success: false, message: '❌ الرسالة غير موجودة' };
    if (msg.author?.id !== client.user?.id) return { success: false, message: '❌ أستطيع تعديل رسائلي فقط' };
    try {
      await msg.edit({ content: String(content).slice(0, 2000) });
      return { success: true, message: `✏️ **تم تعديل الرسالة** في ${channel}`, data: { messageId: msg.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التعديل: ${e.message}` };
    }
  },
});

registerTool('unpin_message', {
  description: 'إزالة تثبيت رسالة (آيدي أو last)',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: الحالية)', required: false },
    messageId: { type: 'string', description: 'آيدي الرسالة أو last', required: false },
  },
  async func({ guild, defaultChannelId }, { channelId, messageId }) {
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة' };
    const msg = await resolveMessageSafe(channel, messageId);
    if (!msg) return { success: false, message: '❌ الرسالة غير موجودة' };
    try {
      await msg.unpin('إزالة تثبيت بواسطة AI');
      return { success: true, message: `📌 **أُزيل تثبيت الرسالة** في ${channel}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إزالة التثبيت: ${e.message}` };
    }
  },
});

registerTool('add_reaction', {
  description: 'إضافة رياكشن (إيموجي) على رسالة',
  adminOnly: false,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: الحالية)', required: false },
    messageId: { type: 'string', description: 'آيدي الرسالة أو last', required: false },
    emoji: { type: 'string', description: 'الإيموجي (مثل 😂 أو اسم إيموجي السيرفر)', required: true },
  },
  async func({ guild, defaultChannelId }, { channelId, messageId, emoji }) {
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة' };
    const msg = await resolveMessageSafe(channel, messageId);
    if (!msg) return { success: false, message: '❌ الرسالة غير موجودة' };
    try {
      await msg.react(String(emoji));
      return { success: true, message: `👍 **تم التفاعل بـ ${emoji}**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التفاعل: ${e.message}` };
    }
  },
});

registerTool('send_poll', {
  description: 'إنشاء استفتاء (Poll) في قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: الحالية)', required: false },
    question: { type: 'string', description: 'سؤال الاستفتاء', required: true },
    answers: { type: 'array', description: 'خيارات الإجابة (2-10)', required: true },
    durationHours: { type: 'number', description: 'المدة بالساعات (1-768)', required: false },
    multiple: { type: 'boolean', description: 'السماح بأكثر من اختيار؟', required: false },
  },
  async func({ guild, defaultChannelId }, { channelId, question, answers, durationHours = 24, multiple = false }) {
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    if (!channel) return { success: false, message: '❌ قناة نصية غير صالحة' };
    const list = (Array.isArray(answers) ? answers : String(answers || '').split(/[،,\n]/))
      .map((a: any) => String(a).trim()).filter(Boolean).slice(0, 10);
    if (list.length < 2) return { success: false, message: '❌ الاستفتاء يحتاج خيارين على الأقل' };
    try {
      const msg = await channel.send({
        poll: {
          question: { text: String(question).slice(0, 300) },
          answers: list.map((text: string) => ({ text: text.slice(0, 55) })),
          duration: Math.min(768, Math.max(1, Math.trunc(Number(durationHours)))),
          allowMultiselect: !!multiple,
        },
      });
      return { success: true, message: `📊 **تم إنشاء الاستفتاء في** ${channel}`, data: { messageId: msg.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء الاستفتاء: ${e.message}` };
    }
  },
});

registerTool('create_forum_post', {
  description: 'إنشاء منشور (موضوع) في قناة منتدى',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم قناة المنتدى (افتراضي: الحالية)', required: false },
    title: { type: 'string', description: 'عنوان المنشور', required: true },
    content: { type: 'string', description: 'محتوى المنشور', required: true },
    tags: { type: 'array', description: 'أسماء وسوم منشورات (اختياري)', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, title, content, tags }) {
    const ch = resolveChannelByIdOrName(guild, channelId ?? defaultChannelId);
    if (!ch || (ch as any).type !== ChannelType.GuildForum) return { success: false, message: '❌ قناة منتدى غير صالحة' };
    try {
      const forum: any = ch;
      const appliedTags = Array.isArray(tags)
        ? tags.map((t: any) => forum.availableTags?.find((x: any) => x.name?.toLowerCase() === String(t).toLowerCase() || x.id === String(t))?.id).filter(Boolean)
        : [];
      const thread = await forum.threads.create({
        name: String(title).slice(0, 100),
        message: { content: String(content).slice(0, 2000) },
        appliedTags,
        reason: `${executor.user.tag}: منشور بواسطة AI`,
      });
      return { success: true, message: `📌 **تم إنشاء منشور** ${thread}`, data: { threadId: thread.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء المنشور: ${e.message}` };
    }
  },
});

registerTool('archive_thread', {
  description: 'أرشفة/إلغاء أرشفة ثريد أو قفله',
  adminOnly: true,
  params: {
    thread: { type: 'string', description: 'آيدي/اسم الثريد', required: true },
    archived: { type: 'boolean', description: 'true أرشفة / false إلغاء الأرشفة', required: false },
    locked: { type: 'boolean', description: 'قفل الثريد؟ (اختياري)', required: false },
  },
  async func({ guild, executor }, { thread, archived = true, locked }) {
    const th = resolveThreadSafe(guild, thread);
    if (!th) return { success: false, message: '❌ الثريد غير موجود' };
    try {
      await th.setArchived(!!archived, `${executor.user.tag}: أرشفة بواسطة AI`);
      if (locked !== undefined) await th.setLocked(!!locked, `${executor.user.tag}: قفل بواسطة AI`);
      return { success: true, message: archived ? `🗄️ **تمت أرشفة الثريد** ${th}` : `🔓 **أُلغي أرشفة الثريد** ${th}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تعديل الثريد: ${e.message}` };
    }
  },
});

registerTool('delete_thread', {
  description: 'حذف ثريد نهائياً',
  adminOnly: true,
  params: {
    thread: { type: 'string', description: 'آيدي/اسم الثريد', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { thread, reason = 'حذف ثريد بواسطة AI' }) {
    const th = resolveThreadSafe(guild, thread);
    if (!th) return { success: false, message: '❌ الثريد غير موجود' };
    try {
      await th.delete(`${executor.user.tag}: ${reason}`);
      return { success: true, message: `🗑️ **تم حذف الثريد**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('clone_channel', {
  description: 'نسخ قناة أو فئة بكل إعداداتها',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: الحالية)', required: false },
    name: { type: 'string', description: 'اسم النسخة (اختياري)', required: false },
  },
  async func({ guild, client, executor, defaultChannelId }, { channelId, name }) {
    const ch = resolveChannelByIdOrName(guild, channelId ?? defaultChannelId);
    if (!ch) return { success: false, message: '❌ القناة غير موجودة' };
    try {
      client.securityHandler?.noteSelfCreatedName(guild.id, 'channel', name ? String(name).slice(0, 100) : ch.name);
      const copy = await (ch as any).clone({ name: name ? String(name).slice(0, 100) : undefined, reason: `${executor.user.tag}: نسخ قناة بواسطة AI` });
      client.securityHandler?.noteSelfCreated(guild.id, 'channel', copy.id);
      return { success: true, message: `📑 **تم نسخ القناة** ${copy}`, data: { channelId: copy.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل النسخ: ${e.message}` };
    }
  },
});

registerTool('set_channel_bitrate', {
  description: 'ضبط جودة الصوت (Bitrate) لقناة صوتية',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة الصوتية (افتراضي: الحالية)', required: false },
    bitrateKbps: { type: 'number', description: 'الجودة بالكيلوبت (8-384)', required: true },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, bitrateKbps }) {
    const ch = resolveChannelByIdOrName(guild, channelId ?? defaultChannelId);
    if (!ch || ch.type !== ChannelType.GuildVoice) return { success: false, message: '❌ قناة صوتية غير صالحة' };
    const kbps = Math.min(384, Math.max(8, Math.trunc(Number(bitrateKbps))));
    try {
      await (ch as VoiceChannel).setBitrate(kbps * 1000, `${executor.user.tag}: جودة صوت بواسطة AI`);
      return { success: true, message: `🎚️ **جودة الصوت الآن ${kbps} kbps في** ${ch}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الضبط: ${e.message}` };
    }
  },
});

// --------------------------------------------
// 🎭 رولات
// --------------------------------------------

registerTool('clone_role', {
  description: 'نسخ رول بكل صلاحياته ولونه',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي/اسم الرول', required: true },
    name: { type: 'string', description: 'اسم النسخة (اختياري)', required: false },
  },
  async func({ guild, client, executor }, { roleId, name }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (role.id === guild.id) return { success: false, message: '❌ لا يمكن نسخ @everyone' };
    try {
      client.securityHandler?.noteSelfCreatedName(guild.id, 'role', (name ? String(name) : `${role.name} (نسخة)`).slice(0, 100));
      const copy = await guild.roles.create({
        name: (name ? String(name) : `${role.name} (نسخة)`).slice(0, 100),
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.bitfield as any,
        reason: `${executor.user.tag}: نسخ رول بواسطة AI`,
      });
      client.securityHandler?.noteSelfCreated(guild.id, 'role', copy.id);
      return { success: true, message: `📑 **تم نسخ الرول** ${copy}`, data: { roleId: copy.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل النسخ: ${e.message}` };
    }
  },
});

registerTool('set_role_color', {
  description: 'تغيير لون رول',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي/اسم الرول', required: true },
    color: { type: 'string', description: 'اللون هكس مثل #ff0000', required: true },
  },
  async func({ guild, executor }, { roleId, color }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!canEditRole(guild, executor, role)) return { success: false, message: '❌ لا يمكنك تعديل هذا الرول (الرتبة/مُدار/@everyone)' };
    const c = parseHexColor(color);
    if (c === null) return { success: false, message: '❌ لون غير صالح — استخدم هكس مثل #ff0000' };
    try {
      await role.setColor(c, `${executor.user.tag}: لون رول بواسطة AI`);
      return { success: true, message: `🎨 **لون الرول** ${role} **أصبح** \`${String(color)}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير اللون: ${e.message}` };
    }
  },
});

registerTool('set_role_icon', {
  description: 'تغيير أيقونة رول (يتطلب تعزيز السيرفر مستوى 2)',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي/اسم الرول', required: true },
    url: { type: 'string', description: 'رابط صورة الأيقونة (اختياري)', required: false },
    emoji: { type: 'string', description: 'إيموجي كأيقونة بدل الصورة (اختياري)', required: false },
  },
  async func({ guild, executor, attachments }, { roleId, url, emoji }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!canEditRole(guild, executor, role)) return { success: false, message: '❌ لا يمكنك تعديل هذا الرول' };
    try {
      if (emoji) {
        await role.setIcon(String(emoji), `${executor.user.tag}: أيقونة رول بواسطة AI`);
      } else {
        const source = url || attachments?.find(a => (a.contentType || '').startsWith('image/'))?.url;
        if (!source) return { success: false, message: '❌ مرّر رابط صورة أو إيموجي' };
        const buffer = await fetchImageBuffer(source);
        await role.setIcon(buffer, `${executor.user.tag}: أيقونة رول بواسطة AI`);
      }
      return { success: true, message: `🖼️ **تم تحديث أيقونة الرول** ${role}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تعديل الأيقونة: ${e.message} (يحتاج تعزيز السيرفر مستوى 2)` };
    }
  },
});

registerTool('set_role_hoist', {
  description: 'إظهار/إخفاء رول منفصلاً في قائمة الأعضاء',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي/اسم الرول', required: true },
    enabled: { type: 'boolean', description: 'true إظهار / false إخفاء', required: true },
  },
  async func({ guild, executor }, { roleId, enabled }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!canEditRole(guild, executor, role)) return { success: false, message: '❌ لا يمكنك تعديل هذا الرول' };
    try {
      await role.setHoist(!!enabled, `${executor.user.tag}: تعديل عرض الرول بواسطة AI`);
      return { success: true, message: enabled ? `✅ **الرول** ${role} **أصبح ظاهراً منفصلاً**` : `✅ **الرول** ${role} **أصبح مخفياً**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التعديل: ${e.message}` };
    }
  },
});

registerTool('set_role_mentionable', {
  description: 'جعل رول قابلاً للمنشن أو منعه',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي/اسم الرول', required: true },
    enabled: { type: 'boolean', description: 'true يسمح بالمنشن / false يمنعه', required: true },
  },
  async func({ guild, executor }, { roleId, enabled }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!canEditRole(guild, executor, role)) return { success: false, message: '❌ لا يمكنك تعديل هذا الرول' };
    try {
      await role.setMentionable(!!enabled, `${executor.user.tag}: تعديل المنشن بواسطة AI`);
      return { success: true, message: enabled ? `✅ **الرول** ${role} **أصبح قابلاً للمنشن**` : `✅ **الرول** ${role} **أصبح غير قابل للمنشن**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التعديل: ${e.message}` };
    }
  },
});

registerTool('set_role_position', {
  description: 'تغيير ترتيب رول في قائمة الرولات (0 = الأعلى بعد @everyone)',
  adminOnly: true,
  params: {
    roleId: { type: 'string', description: 'آيدي/اسم الرول', required: true },
    position: { type: 'number', description: 'الترتيب الجديد', required: true },
  },
  async func({ guild, executor }, { roleId, position }) {
    const role = resolveRoleByIdOrName(guild, roleId);
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!canEditRole(guild, executor, role)) return { success: false, message: '❌ لا يمكنك تعديل هذا الرول' };
    try {
      await role.setPosition(Math.max(0, Math.trunc(Number(position))), { reason: `${executor.user.tag}: ترتيب رول بواسطة AI` });
      return { success: true, message: `↕️ **تم تغيير ترتيب الرول** ${role}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الترتيب: ${e.message}` };
    }
  },
});


// --------------------------------------------
// 👥 أعضاء — حظر/رفع حظر/صوت/رولات/بحث
// --------------------------------------------

registerTool('unban_user', {
  description: 'رفع الحظر عن عضو بالآيدي أو اسم المستخدم',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو أو اسمه', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { userId, reason = 'رفع حظر بواسطة AI' }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.BanMembers, 'حظر الأعضاء');
    if (perm) return perm;
    const needle = String(userId || '').trim();
    let id = /^\d{17,20}$/.test(needle) ? needle : '';
    if (!id) {
      const bans = await guild.bans.fetch().catch(() => null);
      const found = bans?.find(b =>
        b.user.username.toLowerCase() === needle.toLowerCase() ||
        (b.user.globalName || '').toLowerCase() === needle.toLowerCase() ||
        b.user.tag.toLowerCase() === needle.toLowerCase()
      );
      if (found) id = found.user.id;
    }
    if (!id) return { success: false, message: '❌ لم أجد هذا العضو في قائمة المحظورين' };
    try {
      await guild.members.unban(id, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `🔓 **تم رفع الحظر عن** <@${id}>` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل رفع الحظر: ${e.message}` };
    }
  },
});

registerTool('list_bans', {
  description: 'عرض قائمة المحظورين في السيرفر',
  adminOnly: true,
  params: { limit: { type: 'number', description: 'العدد (افتراضي 25)', required: false } },
  async func({ guild }, { limit = 25 }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.BanMembers, 'حظر الأعضاء');
    if (perm) return perm;
    try {
      const bans = await guild.bans.fetch();
      const list = [...bans.values()].slice(0, Math.min(50, Math.max(1, Math.trunc(Number(limit)))));
      if (!list.length) return { success: true, message: '✅ **لا يوجد محظورون في السيرفر**' };
      return {
        success: true,
        message: `🔨 **المحظورون (${bans.size}):**\n` +
          list.map((b, i) => `${i + 1}. ${b.user.tag} — \`${b.user.id}\`${b.reason ? ` — ${b.reason}` : ''}`).join('\n'),
        data: { total: bans.size },
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل جلب المحظورين: ${e.message}` };
    }
  },
});

registerTool('voice_mute', {
  description: 'كتم/فك كتم عضو في القناة الصوتية (Server Mute)',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو (افتراضي: الهدف الممنشن)', required: false },
    enabled: { type: 'boolean', description: 'true كتم / false فك الكتم', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultTargetUserId }, { userId, enabled, reason = 'كتم صوتي بواسطة AI' }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.MuteMembers, 'كتم الأعضاء');
    if (perm) return perm;
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!member.voice?.channel) return { success: false, message: '❌ العضو ليس في قناة صوتية' };
    try {
      await member.voice.setMute(!!enabled, `${executor.user.tag}: ${reason}`);
      return { success: true, message: enabled ? `🔇 **تم كتم** ${member.user.tag} **صوتياً**` : `🔊 **تم فك كتم** ${member.user.tag}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الكتم الصوتي: ${e.message}` };
    }
  },
});

registerTool('voice_deafen', {
  description: 'صم/فك صم عضو في القناة الصوتية (Server Deafen)',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو (افتراضي: الهدف الممنشن)', required: false },
    enabled: { type: 'boolean', description: 'true صم / false فك الصم', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultTargetUserId }, { userId, enabled, reason = 'صم صوتي بواسطة AI' }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.DeafenMembers, 'أصمّ الأعضاء');
    if (perm) return perm;
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!member.voice?.channel) return { success: false, message: '❌ العضو ليس في قناة صوتية' };
    try {
      await member.voice.setDeaf(!!enabled, `${executor.user.tag}: ${reason}`);
      return { success: true, message: enabled ? `🔇 **تم صمّ** ${member.user.tag} **صوتياً**` : `🔊 **تم فك صمّ** ${member.user.tag}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الصمّ الصوتي: ${e.message}` };
    }
  },
});

registerTool('disconnect_voice', {
  description: 'طرد عضو من القناة الصوتية (Disconnect)',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو (افتراضي: الهدف الممنشن)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultTargetUserId }, { userId, reason = 'فصل صوتي بواسطة AI' }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.MoveMembers, 'نقل الأعضاء');
    if (perm) return perm;
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!member.voice?.channel) return { success: false, message: '❌ العضو ليس في قناة صوتية' };
    try {
      await member.voice.disconnect(`${executor.user.tag}: ${reason}`);
      return { success: true, message: `👢 **تم فصل** ${member.user.tag} **من الصوت**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الفصل الصوتي: ${e.message}` };
    }
  },
});

registerTool('set_member_roles', {
  description: 'إدارة رولات عضو دفعة واحدة: إضافة أو إزالة أو استبدال كل الرولات',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو (افتراضي: الهدف الممنشن)', required: false },
    roles: { type: 'array', description: 'أسماء أو آيديز الرولات', required: true },
    mode: { type: 'string', description: 'add / remove / set (افتراضي add)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor, defaultTargetUserId }, { userId, roles, mode = 'add', reason = 'تعديل رولات بواسطة AI' }) {
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!canManageTarget(guild, executor, member)) {
      return { success: false, message: '❌ لا يمكنك تعديل عضو رتبته أعلى منك أو مساوية لرتبتك' };
    }
    const rawList: any[] = Array.isArray(roles) ? roles : String(roles || '').split(/[،,\n]/);
    const resolved = rawList
      .map(r => resolveRoleByIdOrName(guild, String(r).trim()))
      .filter((r): r is Role => !!r);
    if (!resolved.length) return { success: false, message: '❌ لم أجد أي رول مطابق' };
    const invalid = resolved.find(r => !isRoleGrantable(guild, executor, r));
    if (invalid) return { success: false, message: `❌ الرول **${invalid.name}** أعلى من رتبتك أو من رتبة البوت` };

    try {
      if (mode === 'remove') await member.roles.remove(resolved, `${executor.user.tag}: ${reason}`);
      else if (mode === 'set') await member.roles.set(resolved, `${executor.user.tag}: ${reason}`);
      else await member.roles.add(resolved, `${executor.user.tag}: ${reason}`);
      return {
        success: true,
        message: `🎭 **تم تحديث رولات** ${member.user.tag} (${mode}) → ${resolved.map(r => r.name).join('، ')}`,
        data: { roleIds: resolved.map(r => r.id) },
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تعديل الرولات: ${e.message}` };
    }
  },
});

registerTool('search_member', {
  description: 'البحث عن أعضاء بالاسم أو اسم المستخدم وعرض آيديهاتهم',
  adminOnly: false,
  params: {
    query: { type: 'string', description: 'الاسم أو جزء منه', required: true },
    limit: { type: 'number', description: 'عدد النتائج (افتراضي 10)', required: false },
  },
  async func({ guild }, { query, limit = 10 }) {
    const q = String(query || '').trim();
    if (!q) return { success: false, message: '❌ اكتب اسم العضو' };
    try {
      const results = await guild.members.search({ query: q, limit: Math.min(25, Math.max(1, Math.trunc(Number(limit)))) });
      if (!results.size) return { success: true, message: `🔎 **لا يوجد عضو مطابق لـ** \`${q}\`` };
      return {
        success: true,
        message: `🔎 **نتائج البحث عن** \`${q}\`:\n` +
          [...results.values()].map((m, i) => `${i + 1}. ${m.user.tag} — <@${m.id}> — \`${m.id}\``).join('\n'),
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل البحث: ${e.message}` };
    }
  },
});

// --------------------------------------------
// ⚙️ سيرفر — وصف/لغة/قوالب/سجل تدقيق/أقفال/تنظيم
// --------------------------------------------

registerTool('set_server_description', {
  description: 'تغيير وصف السيرفر (يظهر في Discoverable servers)',
  adminOnly: true,
  params: {
    description: { type: 'string', description: 'الوصف الجديد (فارغ للمسح)', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { description, reason = 'وصف السيرفر بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    try {
      await guild.edit({ description: String(description || '').slice(0, 300) || null, reason: `${executor.user.tag}: ${reason}` } as any);
      return { success: true, message: '📝 **تم تحديث وصف السيرفر**' };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير الوصف: ${e.message}` };
    }
  },
});

registerTool('set_server_locale', {
  description: 'تغيير لغة السيرفر الأساسية (مثل ar أو en-US)',
  adminOnly: true,
  params: {
    locale: { type: 'string', description: 'كود اللغة مثل ar / en-US', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { locale, reason = 'لغة السيرفر بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const supported = ['ar', 'en-US', 'en-GB', 'fr', 'de', 'es-ES', 'it', 'pt-BR', 'ru', 'tr', 'ja', 'ko', 'zh-CN', 'hi'];
    const value = String(locale || '').trim();
    if (!supported.includes(value)) return { success: false, message: `❌ لغة غير مدعومة — المتاح: ${supported.join('، ')}` };
    try {
      await guild.setPreferredLocale(value as any, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `🌍 **لغة السيرفر الآن:** \`${value}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير اللغة: ${e.message}` };
    }
  },
});

registerTool('set_special_channel', {
  description: 'تحديد قناة القوانين أو التحديثات أو تنبيهات الأمان',
  adminOnly: true,
  params: {
    type: { type: 'string', description: 'rules / updates / safety', required: true },
    channelId: { type: 'string', description: 'آيدي/اسم القناة (فارغ للإزالة)', required: false },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { type, channelId, reason = 'قناة خاصة بواسطة AI' }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const ch = channelId ? resolveTextChannelSafe(guild, channelId) : null;
    try {
      if (type === 'rules') await guild.setRulesChannel(ch?.id ?? null, `${executor.user.tag}: ${reason}`);
      else if (type === 'updates') await guild.setPublicUpdatesChannel(ch?.id ?? null, `${executor.user.tag}: ${reason}`);
      else if (type === 'safety') await guild.setSafetyAlertsChannel(ch?.id ?? null, `${executor.user.tag}: ${reason}`);
      else return { success: false, message: '❌ النوع: rules / updates / safety فقط' };
      return { success: true, message: ch ? `📌 **تم ضبط قناة ${type}:** ${ch}` : `📌 **تمت إزالة قناة ${type}**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الضبط: ${e.message}` };
    }
  },
});

registerTool('set_afk_timeout', {
  description: 'ضبط مهلة AFK بالثواني (60 / 300 / 900 / 1800 / 3600)',
  adminOnly: true,
  params: { seconds: { type: 'number', description: 'المدة بالثواني', required: true } },
  async func({ guild, executor }, { seconds }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    const allowed = [60, 300, 900, 1800, 3600];
    const value = Math.trunc(Number(seconds));
    if (!allowed.includes(value)) return { success: false, message: `❌ القيمة يجب أن تكون: ${allowed.join(' / ')}` };
    try {
      await guild.setAFKTimeout(value, `${executor.user.tag}: مهلة AFK بواسطة AI`);
      return { success: true, message: `💤 **مهلة AFK الآن:** \`${value}\` ثانية` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الضبط: ${e.message}` };
    }
  },
});

registerTool('create_template', {
  description: 'إنشاء قالب (Template) من السيرفر لمشاركته',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'اسم القالب', required: true },
    description: { type: 'string', description: 'وصف القالب', required: false },
  },
  async func({ guild, executor }, { name, description }) {
    const perm = needManageGuild(guild); if (perm) return perm;
    try {
      const template = await guild.createTemplate(String(name).slice(0, 100), String(description || '').slice(0, 300));
      return { success: true, message: `📦 **تم إنشاء القالب** \`${template.name}\`\n> الرابط: https://discord.new/${template.code}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء القالب: ${e.message}` };
    }
  },
});

registerTool('get_audit_logs', {
  description: 'قراءة سجل التدقيق (آخر العمليات الإدارية)',
  adminOnly: true,
  params: { limit: { type: 'number', description: 'العدد (افتراضي 15)', required: false } },
  async func({ guild }, { limit = 15 }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ViewAuditLog, 'عرض سجل التدقيق');
    if (perm) return perm;
    try {
      const logs = await guild.fetchAuditLogs({ limit: Math.min(50, Math.max(1, Math.trunc(Number(limit)))) });
      const rows = [...logs.entries.values()].map((e: any, i: number) => {
        const action = (AuditLogEvent as any)[e.action] || String(e.action);
        const target = e.target?.tag || e.target?.name || e.target?.id || '—';
        const who = e.executor?.tag || e.executor?.username || 'غير معروف';
        return `${i + 1}. **${action}** — ${who} → ${target}${e.reason ? ` — ${e.reason}` : ''}`;
      });
      return { success: true, message: `📋 **سجل التدقيق:**\n${rows.join('\n') || 'لا توجد عمليات'}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل قراءة السجل: ${e.message}` };
    }
  },
});

registerTool('lockdown_server', {
  description: 'قفل/فتح السيرفر كاملاً (منع الكتابة في كل القنوات النصية) — للطوارئ',
  adminOnly: true,
  dangerous: true,
  params: {
    enabled: { type: 'boolean', description: 'true قفل / false فتح', required: true },
    reason: { type: 'string', description: 'السبب', required: false },
  },
  async func({ guild, executor }, { enabled, reason = 'قفل طوارئ بواسطة AI' }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageChannels, 'إدارة القنوات');
    if (perm) return perm;
    let changed = 0;
    for (const ch of guild.channels.cache.values()) {
      if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) continue;
      try {
        await (ch as TextChannel).permissionOverwrites.edit(
          guild.roles.everyone,
          { SendMessages: enabled ? false : null },
          { reason: `${executor.user.tag}: ${reason}` }
        );
        changed++;
      } catch { /* تجاهل القنوات التي لا أملك صلاحية عليها */ }
    }
    return {
      success: changed > 0,
      message: changed > 0
        ? (enabled ? `🔒 **تم قفل ${changed} قناة** — السيرفر في وضع الطوارئ` : `🔓 **تم فتح ${changed} قناة** — عاد السيرفر طبيعياً`)
        : '❌ لم أستطع تعديل أي قناة (صلاحيات ناقصة)',
    };
  },
});

registerTool('organize_server', {
  description: 'تنظيم السيرفر بالكامل (رولات + فئات + قنوات + صلاحيات) بقالب جاهز',
  adminOnly: true,
  dangerous: true,
  params: {
    preset: { type: 'string', description: 'community أو store', required: true },
    deleteOlds: { type: 'boolean', description: 'حذف القنوات القديمة؟', required: false },
    cleanRoles: { type: 'boolean', description: 'حذف الرولات القديمة؟', required: false },
    pruneChat: { type: 'boolean', description: 'مسح رسائل القنوات؟', required: false },
  },
  async func({ guild, executor }, { preset, deleteOlds = false, cleanRoles = false, pruneChat = false }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageChannels, 'إدارة القنوات');
    if (perm) return perm;
    if (needBotPerm(guild, PermissionFlagsBits.ManageRoles, 'إدارة الرولات')) {
      return { success: false, message: '❌ البوت يحتاج صلاحية **إدارة الرولات (Manage Roles)**' };
    }
    try {
      const { organizePreset } = await import('../utils/serverOrganizer');
      const result = await organizePreset(guild, String(preset || 'community'), { deleteOlds: !!deleteOlds, cleanRoles: !!cleanRoles, pruneChat: !!pruneChat });
      const c = result.counts;
      return {
        success: result.success,
        message: `🏗️ **تم تنظيم السيرفر (${result.presetId})**\n` +
          `> رولات جديدة: ${c.rolesNew} — موجودة: ${c.rolesExisting}\n` +
          `> فئات/قنوات جديدة: ${c.channelsNew} — موجودة: ${c.channelsExisting}\n` +
          `> محذوف: ${result.deleted.roles} رول / ${result.deleted.channels} قناة\n` +
          (result.permErrors.length ? `> ⚠️ أخطاء صلاحيات: ${result.permErrors.slice(0, 5).join(' | ')}` : '> ✅ بدون أخطاء'),
        data: result,
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تنظيم السيرفر: ${e.message}` };
    }
  },
});


// --------------------------------------------
// 😀 إيموجي / ستيكرات / ويب هوك / دعوات
// --------------------------------------------

registerTool('create_emoji', {
  description: 'إضافة إيموجي مخصص للسيرفر من رابط صورة أو مرفق',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'اسم الإيموجي (بدون :)', required: true },
    url: { type: 'string', description: 'رابط الصورة (اختياري — ياخد المرفق تلقائياً)', required: false },
  },
  async func({ guild, executor, attachments }, { name, url }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuildExpressions, 'إدارة التعبيرات');
    if (perm) return perm;
    const source = url || attachments?.find(a => (a.contentType || '').startsWith('image/'))?.url;
    if (!source) return { success: false, message: '❌ مرّر رابط صورة أو أرفق صورة' };
    try {
      const buffer = await fetchImageBuffer(source);
      const emoji = await guild.emojis.create({ attachment: buffer, name: String(name).replace(/[^\w\-]/g, '').slice(0, 32) || 'emoji', reason: `${executor.user.tag}: إيموجي بواسطة AI` });
      return { success: true, message: `😀 **تمت إضافة الإيموجي** ${emoji}`, data: { emojiId: emoji.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إضافة الإيموجي: ${e.message}` };
    }
  },
});

registerTool('delete_emoji', {
  description: 'حذف إيموجي مخصص من السيرفر',
  adminOnly: true,
  params: { emoji: { type: 'string', description: 'اسم أو آيدي الإيموجي', required: true } },
  async func({ guild, executor }, { emoji }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuildExpressions, 'إدارة التعبيرات');
    if (perm) return perm;
    const found = resolveEmojiSafe(guild, emoji);
    if (!found) return { success: false, message: '❌ الإيموجي غير موجود' };
    try {
      const name = found.name;
      await found.delete(`${executor.user.tag}: حذف إيموجي بواسطة AI`);
      return { success: true, message: `🗑️ **تم حذف الإيموجي** \`:${name}:\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('rename_emoji', {
  description: 'تغيير اسم إيموجي مخصص',
  adminOnly: true,
  params: {
    emoji: { type: 'string', description: 'الاسم/الآيدي الحالي', required: true },
    name: { type: 'string', description: 'الاسم الجديد', required: true },
  },
  async func({ guild, executor }, { emoji, name }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuildExpressions, 'إدارة التعبيرات');
    if (perm) return perm;
    const found = resolveEmojiSafe(guild, emoji);
    if (!found) return { success: false, message: '❌ الإيموجي غير موجود' };
    try {
      const updated = await found.edit({ name: String(name).replace(/[^\w\-]/g, '').slice(0, 32), reason: `${executor.user.tag}: تعديل إيموجي بواسطة AI` });
      return { success: true, message: `✏️ **تم تغيير اسم الإيموجي إلى** \`:${updated.name}:\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التعديل: ${e.message}` };
    }
  },
});

registerTool('list_emojis', {
  description: 'عرض إيموجيات السيرفر',
  adminOnly: false,
  params: { limit: { type: 'number', description: 'العدد (افتراضي 30)', required: false } },
  async func({ guild }, { limit = 30 }) {
    const list = [...guild.emojis.cache.values()].slice(0, Math.min(60, Math.max(1, Math.trunc(Number(limit)))));
    if (!list.length) return { success: true, message: '😶 **لا توجد إيموجيات مخصصة في السيرفر**' };
    return {
      success: true,
      message: `😀 **إيموجيات السيرفر (${guild.emojis.cache.size}):**\n` +
        list.map(e => `${e} \`:${e.name}:\` — \`${e.id}\`${e.animated ? ' (متحرك)' : ''}`).join('\n'),
    };
  },
});

registerTool('create_sticker', {
  description: 'إضافة ستيكر للسيرفر من رابط صورة أو مرفق',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'اسم الستيكر', required: true },
    tags: { type: 'string', description: 'كلمة وصفية للستيكر', required: true },
    url: { type: 'string', description: 'رابط الصورة (اختياري)', required: false },
    description: { type: 'string', description: 'وصف (اختياري)', required: false },
  },
  async func({ guild, executor, attachments }, { name, tags, url, description }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuildExpressions, 'إدارة التعبيرات');
    if (perm) return perm;
    const source = url || attachments?.find(a => (a.contentType || '').startsWith('image/'))?.url;
    if (!source) return { success: false, message: '❌ مرّر رابط صورة أو أرفق صورة' };
    try {
      const buffer = await fetchImageBuffer(source);
      const sticker = await guild.stickers.create({
        file: buffer,
        name: String(name).slice(0, 30),
        tags: String(tags).slice(0, 200),
        description: description ? String(description).slice(0, 200) : null,
        reason: `${executor.user.tag}: ستيكر بواسطة AI`,
      } as any);
      return { success: true, message: `🩹 **تمت إضافة الستيكر** \`${sticker.name}\``, data: { stickerId: sticker.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إضافة الستيكر: ${e.message}` };
    }
  },
});

registerTool('delete_sticker', {
  description: 'حذف ستيكر من السيرفر',
  adminOnly: true,
  params: { sticker: { type: 'string', description: 'اسم أو آيدي الستيكر', required: true } },
  async func({ guild, executor }, { sticker }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuildExpressions, 'إدارة التعبيرات');
    if (perm) return perm;
    const raw = String(sticker || '').trim();
    const found = guild.stickers.cache.get(raw) ||
      guild.stickers.cache.find(s => s.name.toLowerCase() === raw.toLowerCase()) ||
      guild.stickers.cache.find(s => s.name.toLowerCase().includes(raw.toLowerCase()));
    if (!found) return { success: false, message: '❌ الستيكر غير موجود' };
    try {
      await guild.stickers.delete(found.id, `${executor.user.tag}: حذف ستيكر بواسطة AI`);
      return { success: true, message: `🗑️ **تم حذف الستيكر** \`${found.name}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('list_stickers', {
  description: 'عرض ستيكرات السيرفر',
  adminOnly: false,
  params: {},
  async func({ guild }) {
    try {
      const stickers = await guild.stickers.fetch();
      if (!stickers.size) return { success: true, message: '🩹 **لا توجد ستيكرات في السيرفر**' };
      return { success: true, message: `🩹 **ستيكرات السيرفر (${stickers.size}):**\n` + [...stickers.values()].map(s => `• \`${s.name}\` — \`${s.id}\``).join('\n') };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الجلب: ${e.message}` };
    }
  },
});

registerTool('create_webhook', {
  description: 'إنشاء ويب هوك في قناة',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم القناة (افتراضي: الحالية)', required: false },
    name: { type: 'string', description: 'اسم الويب هوك', required: true },
    avatarUrl: { type: 'string', description: 'رابط صورة الويب هوك (اختياري)', required: false },
  },
  async func({ guild, executor, defaultChannelId }, { channelId, name, avatarUrl }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageWebhooks, 'إدارة الويب هوك');
    if (perm) return perm;
    const channel = resolveTextChannelSafe(guild, channelId ?? defaultChannelId) as TextChannel | null;
    if (!channel || typeof (channel as any).createWebhook !== 'function') return { success: false, message: '❌ قناة نصية غير صالحة' };
    try {
      const hook = await channel.createWebhook({ name: String(name).slice(0, 80), avatar: avatarUrl || undefined, reason: `${executor.user.tag}: ويب هوك بواسطة AI` });
      return { success: true, message: `🪝 **تم إنشاء ويب هوك** \`${hook.name}\`\n> الرابط: ${hook.url}`, data: { webhookId: hook.id, url: hook.url } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء الويب هوك: ${e.message}` };
    }
  },
});

registerTool('list_webhooks', {
  description: 'عرض ويب هوكس السيرفر',
  adminOnly: true,
  params: { channelId: { type: 'string', description: 'قناة محددة (اختياري)', required: false } },
  async func({ guild, defaultChannelId }, { channelId }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageWebhooks, 'إدارة الويب هوك');
    if (perm) return perm;
    try {
      const hooks = channelId ?? defaultChannelId
        ? await (resolveTextChannelSafe(guild, channelId ?? defaultChannelId) as any)?.fetchWebhooks?.()
        : await guild.fetchWebhooks();
      const list = hooks ? [...hooks.values()] : [];
      if (!list.length) return { success: true, message: '🪝 **لا توجد ويب هوكس**' };
      return { success: true, message: `🪝 **الويب هوكس (${list.length}):**\n` + list.map((h: any) => `• \`${h.name}\` — \`${h.id}\` — <#${h.channelId}>`).join('\n') };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الجلب: ${e.message}` };
    }
  },
});

registerTool('delete_webhook', {
  description: 'حذف ويب هوك بالآيدي أو الاسم',
  adminOnly: true,
  params: { webhook: { type: 'string', description: 'آيدي أو اسم الويب هوك', required: true } },
  async func({ guild, executor }, { webhook }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageWebhooks, 'إدارة الويب هوك');
    if (perm) return perm;
    try {
      const hooks = await guild.fetchWebhooks();
      const raw = String(webhook || '').trim();
      const found = hooks.get(raw) || hooks.find((h: any) => h.name?.toLowerCase() === raw.toLowerCase()) || hooks.find((h: any) => h.name?.toLowerCase().includes(raw.toLowerCase()));
      if (!found) return { success: false, message: '❌ الويب هوك غير موجود' };
      await found.delete(`${executor.user.tag}: حذف ويب هوك بواسطة AI`);
      return { success: true, message: `🗑️ **تم حذف الويب هوك** \`${found.name}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('send_webhook_message', {
  description: 'إرسال رسالة عبر ويب هوك موجود',
  adminOnly: true,
  params: {
    webhook: { type: 'string', description: 'آيدي أو اسم الويب هوك', required: true },
    content: { type: 'string', description: 'نص الرسالة', required: true },
    username: { type: 'string', description: 'اسم العرض (اختياري)', required: false },
  },
  async func({ guild, executor }, { webhook, content, username }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageWebhooks, 'إدارة الويب هوك');
    if (perm) return perm;
    try {
      const hooks = await guild.fetchWebhooks();
      const raw = String(webhook || '').trim();
      const found: any = hooks.get(raw) || hooks.find((h: any) => h.name?.toLowerCase() === raw.toLowerCase());
      if (!found) return { success: false, message: '❌ الويب هوك غير موجود' };
      await found.send({ content: String(content).slice(0, 2000), username: username ? String(username).slice(0, 80) : undefined });
      return { success: true, message: `📨 **تم الإرسال عبر الويب هوك** \`${found.name}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإرسال: ${e.message}` };
    }
  },
});

registerTool('list_invites', {
  description: 'عرض دعوات السيرفر النشطة',
  adminOnly: true,
  params: {},
  async func({ guild }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuild, 'إدارة السيرفر');
    if (perm) return perm;
    try {
      const invites = await guild.invites.fetch();
      if (!invites.size) return { success: true, message: '🔗 **لا توجد دعوات نشطة**' };
      return {
        success: true,
        message: `🔗 **الدعوات النشطة (${invites.size}):**\n` +
          [...invites.values()].slice(0, 30).map(i => `• \`${i.code}\` — <#${i.channelId}> — استخدمات: ${i.uses ?? 0}${i.inviter ? ` — بواسطة ${i.inviter.tag}` : ''}`).join('\n'),
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الجلب: ${e.message}` };
    }
  },
});


// --------------------------------------------
// 📅 أحداث مجدولة / 🤖 أوتومود
// --------------------------------------------

registerTool('create_event', {
  description: 'إنشاء حدث مجدول (فعالية) في السيرفر',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'اسم الفعالية', required: true },
    startTime: { type: 'string', description: 'وقت البداية ISO مثل 2026-01-01T20:00:00Z', required: true },
    endTime: { type: 'string', description: 'وقت النهاية ISO (اختياري)', required: false },
    description: { type: 'string', description: 'وصف الفعالية', required: false },
    channelId: { type: 'string', description: 'قناة صوتية (اختياري — بدونها فعالية خارجية)', required: false },
    location: { type: 'string', description: 'مكان الفعالية الخارجية (اختياري)', required: false },
  },
  async func({ guild, executor }, { name, startTime, endTime, description, channelId, location }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageEvents, 'إدارة الأحداث');
    if (perm) return perm;
    const start = new Date(String(startTime));
    if (Number.isNaN(start.getTime())) return { success: false, message: '❌ وقت البداية غير صالح — استخدم ISO' };
    const voice = channelId ? resolveChannelByIdOrName(guild, channelId) : null;
    const isVoice = !!voice && (voice as any).type === ChannelType.GuildVoice;
    try {
      const event = await guild.scheduledEvents.create({
        name: String(name).slice(0, 100),
        scheduledStartTime: start,
        scheduledEndTime: endTime ? new Date(String(endTime)) : undefined,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: isVoice ? GuildScheduledEventEntityType.Voice : GuildScheduledEventEntityType.External,
        description: description ? String(description).slice(0, 1000) : undefined,
        channel: isVoice ? (voice as any).id : undefined,
        entityMetadata: isVoice ? undefined : { location: String(location || 'Discord').slice(0, 100) },
        reason: `${executor.user.tag}: فعالية بواسطة AI`,
      });
      return { success: true, message: `📅 **تم إنشاء الفعالية** \`${event.name}\`\n> البداية: ${start.toLocaleString('ar-EG')}`, data: { eventId: event.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء الفعالية: ${e.message}` };
    }
  },
});

registerTool('list_events', {
  description: 'عرض الأحداث المجدولة في السيرفر',
  adminOnly: false,
  params: {},
  async func({ guild }) {
    try {
      const events = await guild.scheduledEvents.fetch();
      if (!events.size) return { success: true, message: '📅 **لا توجد أحداث مجدولة**' };
      return {
        success: true,
        message: `📅 **الأحداث (${events.size}):**\n` +
          [...events.values()].slice(0, 20).map(e => `• \`${e.name}\` — ${e.scheduledStartAt?.toLocaleString('ar-EG') || '—'} — ${e.status === 1 ? 'قادم' : e.status === 2 ? 'جارٍ' : e.status === 3 ? 'منتهي' : 'ملغي'}`).join('\n'),
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الجلب: ${e.message}` };
    }
  },
});

registerTool('delete_event', {
  description: 'حذف حدث مجدول بالاسم أو الآيدي',
  adminOnly: true,
  params: { event: { type: 'string', description: 'اسم أو آيدي الحدث', required: true } },
  async func({ guild, executor }, { event }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageEvents, 'إدارة الأحداث');
    if (perm) return perm;
    const raw = String(event || '').trim();
    try {
      const events = await guild.scheduledEvents.fetch();
      const found = events.get(raw) ||
        events.find(e => e.name.toLowerCase() === raw.toLowerCase()) ||
        events.find(e => e.name.toLowerCase().includes(raw.toLowerCase()));
      if (!found) return { success: false, message: '❌ الحدث غير موجود' };
      await guild.scheduledEvents.delete(found);
      return { success: true, message: `🗑️ **تم حذف الفعالية** \`${found.name}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});

registerTool('create_automod_rule', {
  description: 'إنشاء قاعدة أوتومود (كلمات ممنوعة/سبام/منشن/محتوى)',
  adminOnly: true,
  dangerous: true,
  params: {
    name: { type: 'string', description: 'اسم القاعدة', required: true },
    trigger: { type: 'string', description: 'keyword / spam / mention / keyword_preset', required: true },
    keywords: { type: 'array', description: 'الكلمات الممنوعة (لـ keyword)', required: false },
    action: { type: 'string', description: 'block / timeout (افتراضي block)', required: false },
    durationSeconds: { type: 'number', description: 'مدة التايم أوت بالثواني (افتراضي 600)', required: false },
    alertChannelId: { type: 'string', description: 'قناة تنبيه الإدارة (اختياري)', required: false },
  },
  async func({ guild, executor }, { name, trigger, keywords, action = 'block', durationSeconds = 600, alertChannelId }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuild, 'إدارة السيرفر');
    if (perm) return perm;
    const alert = alertChannelId ? resolveTextChannelSafe(guild, alertChannelId) : null;
    const actions: any[] = [];
    if (action === 'timeout') {
      actions.push({ type: AutoModerationActionType.Timeout, metadata: { durationSeconds: Math.min(2_419_200, Math.max(60, Math.trunc(Number(durationSeconds)))) } });
    } else {
      actions.push({ type: AutoModerationActionType.BlockMessage });
    }
    if (alert) actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: alert.id } });

    let triggerType: AutoModerationRuleTriggerType;
    let triggerMetadata: any = {};
    if (trigger === 'spam') triggerType = AutoModerationRuleTriggerType.Spam;
    else if (trigger === 'mention') { triggerType = AutoModerationRuleTriggerType.MentionSpam; triggerMetadata = { mentionTotalLimit: 5 }; }
    else if (trigger === 'keyword_preset') { triggerType = AutoModerationRuleTriggerType.KeywordPreset; triggerMetadata = { presets: [1, 2, 3] }; }
    else if (trigger === 'keyword') {
      triggerType = AutoModerationRuleTriggerType.Keyword;
      const words = (Array.isArray(keywords) ? keywords : String(keywords || '').split(/[،,\n]/)).map(w => String(w).trim()).filter(Boolean).slice(0, 1000);
      if (!words.length) return { success: false, message: '❌ مرّر الكلمات الممنوعة في keywords' };
      triggerMetadata = { keywordFilter: words };
    } else return { success: false, message: '❌ النوع: keyword / spam / mention / keyword_preset' };

    try {
      const rule = await guild.autoModerationRules.create({
        name: String(name).slice(0, 100),
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType,
        triggerMetadata,
        actions,
        enabled: true,
        reason: `${executor.user.tag}: أوتومود بواسطة AI`,
      });
      return { success: true, message: `🤖 **تم إنشاء قاعدة الأوتومود** \`${rule.name}\`\n> النوع: ${trigger} — الإجراء: ${action}`, data: { ruleId: rule.id } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنشاء القاعدة: ${e.message}` };
    }
  },
});

registerTool('list_automod_rules', {
  description: 'عرض قواعد الأوتومود في السيرفر',
  adminOnly: true,
  params: {},
  async func({ guild }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuild, 'إدارة السيرفر');
    if (perm) return perm;
    try {
      const rules = await guild.autoModerationRules.fetch();
      if (!rules.size) return { success: true, message: '🤖 **لا توجد قواعد أوتومود**' };
      return {
        success: true,
        message: `🤖 **قواعد الأوتومود (${rules.size}):**\n` +
          [...rules.values()].map(r => `• \`${r.name}\` — ${r.enabled ? '✅ مفعّلة' : '❌ معطّلة'} — \`${r.id}\``).join('\n'),
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الجلب: ${e.message}` };
    }
  },
});

registerTool('toggle_automod_rule', {
  description: 'تفعيل/تعطيل قاعدة أوتومود',
  adminOnly: true,
  params: {
    rule: { type: 'string', description: 'اسم أو آيدي القاعدة', required: true },
    enabled: { type: 'boolean', description: 'true تفعيل / false تعطيل', required: true },
  },
  async func({ guild, executor }, { rule, enabled }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuild, 'إدارة السيرفر');
    if (perm) return perm;
    const raw = String(rule || '').trim();
    try {
      const rules = await guild.autoModerationRules.fetch();
      const found = rules.get(raw) || rules.find(r => r.name.toLowerCase() === raw.toLowerCase()) || rules.find(r => r.name.toLowerCase().includes(raw.toLowerCase()));
      if (!found) return { success: false, message: '❌ القاعدة غير موجودة' };
      await found.setEnabled(!!enabled, `${executor.user.tag}: تعديل أوتومود بواسطة AI`);
      return { success: true, message: enabled ? `✅ **تم تفعيل قاعدة** \`${found.name}\`` : `⏸️ **تم تعطيل قاعدة** \`${found.name}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التعديل: ${e.message}` };
    }
  },
});

registerTool('delete_automod_rule', {
  description: 'حذف قاعدة أوتومود',
  adminOnly: true,
  dangerous: true,
  params: { rule: { type: 'string', description: 'اسم أو آيدي القاعدة', required: true } },
  async func({ guild, executor }, { rule }) {
    const perm = needBotPerm(guild, PermissionFlagsBits.ManageGuild, 'إدارة السيرفر');
    if (perm) return perm;
    const raw = String(rule || '').trim();
    try {
      const rules = await guild.autoModerationRules.fetch();
      const found = rules.get(raw) || rules.find(r => r.name.toLowerCase() === raw.toLowerCase()) || rules.find(r => r.name.toLowerCase().includes(raw.toLowerCase()));
      if (!found) return { success: false, message: '❌ القاعدة غير موجودة' };
      await found.delete(`${executor.user.tag}: حذف أوتومود بواسطة AI`);
      return { success: true, message: `🗑️ **تم حذف القاعدة** \`${found.name}\`` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الحذف: ${e.message}` };
    }
  },
});


// --------------------------------------------
// 🎵 موسيقى
// --------------------------------------------

function musicHandlerOf(client: any): any {
  return client?.musicHandler;
}

function canControlMusic(guild: Guild, executor: GuildMember): boolean {
  return sameVoiceChannel(guild, executor) ||
    executor.permissions.has(PermissionFlagsBits.ManageGuild) ||
    executor.id === guild.ownerId;
}

registerTool('music_play', {
  description: 'تشغيل أغنية أو إضافة بحث/رابط لقائمة الموسيقى (لازم تكون في قناة صوتية)',
  adminOnly: false,
  params: {
    query: { type: 'string', description: 'اسم الأغنية أو رابط يوتيوب/ساوند كلاود', required: true },
  },
  async func({ guild, client, executor, defaultChannelId }, { query }) {
    if (!executor.voice?.channel) return { success: false, message: '❌ ادخل قناة صوتية أولاً عشان أشغّل الموسيقى' };
    const music = musicHandlerOf(client);
    if (!music) return { success: false, message: '❌ نظام الموسيقى غير متاح' };
    try {
      const result = await music.play(executor, String(query), defaultChannelId);
      return { success: !!result.success, message: result.message || (result.success ? '🎵 تم التشغيل' : '❌ تعذّر التشغيل') };
    } catch (e: any) {
      return { success: false, message: `❌ فشل التشغيل: ${e.message}` };
    }
  },
});

registerTool('music_skip', {
  description: 'تخطي الأغنية الحالية',
  adminOnly: false,
  params: {},
  async func({ guild, client, executor }) {
    if (!canControlMusic(guild, executor)) return { success: false, message: '❌ لازم تكون في نفس القناة الصوتية أو إداري' };
    const music = musicHandlerOf(client);
    const ok = music?.skip(guild.id);
    return { success: !!ok, message: ok ? '⏭️ **تم تخطي الأغنية**' : '❌ لا توجد أغنية تعمل الآن' };
  },
});

registerTool('music_stop', {
  description: 'إيقاف الموسيقى وتفريغ القائمة',
  adminOnly: false,
  params: {},
  async func({ guild, client, executor }) {
    if (!canControlMusic(guild, executor)) return { success: false, message: '❌ لازم تكون في نفس القناة الصوتية أو إداري' };
    const music = musicHandlerOf(client);
    const ok = music?.stop(guild.id);
    return { success: !!ok, message: ok ? '⏹️ **تم إيقاف الموسيقى وتفريغ القائمة**' : '❌ لا توجد موسيقى تعمل' };
  },
});

registerTool('music_pause', {
  description: 'إيقاف مؤقت للموسيقى',
  adminOnly: false,
  params: {},
  async func({ guild, client, executor }) {
    if (!canControlMusic(guild, executor)) return { success: false, message: '❌ لازم تكون في نفس القناة الصوتية أو إداري' };
    const music = musicHandlerOf(client);
    const ok = music?.pause(guild.id);
    return { success: !!ok, message: ok ? '⏸️ **تم الإيقاف المؤقت**' : '❌ لا توجد موسيقى تعمل' };
  },
});

registerTool('music_resume', {
  description: 'استئناف الموسيقى بعد الإيقاف المؤقت',
  adminOnly: false,
  params: {},
  async func({ guild, client, executor }) {
    if (!canControlMusic(guild, executor)) return { success: false, message: '❌ لازم تكون في نفس القناة الصوتية أو إداري' };
    const music = musicHandlerOf(client);
    const ok = music?.resume(guild.id);
    return { success: !!ok, message: ok ? '▶️ **تم استئناف الموسيقى**' : '❌ لا توجد موسيقى متوقفة' };
  },
});

registerTool('music_volume', {
  description: 'ضبط مستوى صوت الموسيقى (0-200)',
  adminOnly: false,
  params: { volume: { type: 'number', description: 'مستوى الصوت 0-200', required: true } },
  async func({ guild, client, executor }, { volume }) {
    if (!canControlMusic(guild, executor)) return { success: false, message: '❌ لازم تكون في نفس القناة الصوتية أو إداري' };
    const music = musicHandlerOf(client);
    const value = Math.min(200, Math.max(0, Math.trunc(Number(volume))));
    const ok = music?.setVolume(guild.id, value);
    return { success: !!ok, message: ok ? `🔊 **مستوى الصوت الآن:** \`${value}%\`` : '❌ لا توجد موسيقى تعمل' };
  },
});

registerTool('music_shuffle', {
  description: 'خلط ترتيب قائمة الموسيقى',
  adminOnly: false,
  params: {},
  async func({ guild, client, executor }) {
    if (!canControlMusic(guild, executor)) return { success: false, message: '❌ لازم تكون في نفس القناة الصوتية أو إداري' };
    const music = musicHandlerOf(client);
    const ok = music?.shuffle(guild.id);
    return { success: !!ok, message: ok ? '🔀 **تم خلط القائمة**' : '❌ القائمة فارغة' };
  },
});

registerTool('music_leave', {
  description: 'إخراج البوت من القناة الصوتية',
  adminOnly: false,
  params: {},
  async func({ guild, client, executor }) {
    if (!canControlMusic(guild, executor)) return { success: false, message: '❌ لازم تكون في نفس القناة الصوتية أو إداري' };
    const music = musicHandlerOf(client);
    if (!music) return { success: false, message: '❌ نظام الموسيقى غير متاح' };
    music.leave(guild.id);
    return { success: true, message: '👋 **خرجت من القناة الصوتية**' };
  },
});

registerTool('music_queue', {
  description: 'عرض قائمة الموسيقى الحالية',
  adminOnly: false,
  params: {},
  async func({ guild, client }) {
    const music = musicHandlerOf(client);
    const queue = music?.getQueue ? music.getQueue(guild.id) : null;
    if (!queue || (!queue.currentTrack && !queue.tracks?.length)) return { success: true, message: '🎵 **القائمة فارغة** — شغّل أغنية الأول' };
    const lines = [
      queue.currentTrack ? `▶️ **الآن:** ${queue.currentTrack.title}` : '⏸️ لا يوجد تشغيل',
      ...queue.tracks.slice(0, 20).map((t: any, i: number) => `${i + 1}. ${t.title}`),
    ];
    return { success: true, message: `🎶 **قائمة الموسيقى:**\n${lines.join('\n')}${queue.tracks.length > 20 ? `\n... و${queue.tracks.length - 20} أخرى` : ''}` };
  },
});


// --------------------------------------------
// 🎫 تذاكر
// --------------------------------------------

registerTool('open_ticket', {
  description: 'فتح تذكرة دعم جديدة لصاحب الطلب',
  adminOnly: false,
  params: {
    type: { type: 'string', description: 'نوع التذكرة (افتراضي: عام)', required: false },
    subject: { type: 'string', description: 'موضوع التذكرة', required: false },
  },
  async func({ guild, client, executor }, { type = 'عام', subject }) {
    const handler = (client as any).ticketHandler;
    if (!handler) return { success: false, message: '❌ نظام التذاكر غير متاح' };
    try {
      const ticket = await handler.createTicket({ guild, user: executor, type: String(type).slice(0, 50), subject: subject ? String(subject).slice(0, 200) : undefined });
      const chId = (ticket as any)?.channelId;
      return { success: true, message: `🎫 **تم فتح تذكرة${chId ? ` في <#${chId}>` : ''}**`, data: { ticket } };
    } catch (e: any) {
      return { success: false, message: `❌ فشل فتح التذكرة: ${e.message}` };
    }
  },
});

registerTool('add_ticket_member', {
  description: 'إضافة عضو إلى التذكرة الحالية',
  adminOnly: true,
  params: {
    userId: { type: 'string', description: 'آيدي العضو (افتراضي: الهدف الممنشن)', required: false },
  },
  async func({ guild, client, executor, defaultChannelId, defaultTargetUserId }, { userId }) {
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ حدد العضو أو منشنِه' };
    const handler = (client as any).ticketHandler;
    if (!handler || !defaultChannelId) return { success: false, message: '❌ هذه ليست قناة تذكرة' };
    const member = await guild.members.fetch(String(targetId)).catch(() => null);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    try {
      await handler.addMemberToTicket(defaultChannelId, member, executor);
      return { success: true, message: `➕ **تمت إضافة** ${member.user.tag} **إلى التذكرة**` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإضافة: ${e.message}` };
    }
  },
});

registerTool('claim_ticket', {
  description: 'استلام التذكرة الحالية باسمك',
  adminOnly: true,
  params: {},
  async func({ guild, client, executor, defaultChannelId }) {
    const handler = (client as any).ticketHandler;
    if (!handler || !defaultChannelId) return { success: false, message: '❌ هذه ليست قناة تذكرة' };
    try {
      await handler.claimTicket(defaultChannelId, executor);
      return { success: true, message: `🙋 **تم استلام التذكرة بواسطة** ${executor.user.tag}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الاستلام: ${e.message}` };
    }
  },
});

registerTool('close_ticket', {
  description: 'إغلاق تذكرة محددة (بالقناة أو الحالية)',
  adminOnly: true,
  params: {
    channelId: { type: 'string', description: 'آيدي/اسم قناة التذكرة (افتراضي: الحالية)', required: false },
    reason: { type: 'string', description: 'سبب الإغلاق', required: false },
  },
  async func({ guild, client, executor, defaultChannelId }, { channelId, reason = 'إغلاق بواسطة AI' }) {
    const target = resolveTextChannelSafe(guild, channelId ?? defaultChannelId);
    const handler = (client as any).ticketHandler;
    if (!target || !handler) return { success: false, message: '❌ قناة تذكرة غير صالحة' };
    try {
      const { Ticket } = await import('../models');
      const ticket = await Ticket.findOne({ guildId: guild.id, channelId: target.id, status: { $in: ['open', 'claimed', 'waiting'] } });
      if (!ticket) return { success: false, message: '❌ هذه ليست تذكرة مفتوحة' };
      await handler.closeTicket(target.id, executor, String(reason));
      return { success: true, message: `🔒 **تم إغلاق التذكرة** ${target}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الإغلاق: ${e.message}` };
    }
  },
});


// --------------------------------------------
// 🎁 سحب
// --------------------------------------------

registerTool('giveaway_end', {
  description: 'إنهاء سحب قبل وقته أو في وقته (بدون اختيار فائز تلقائي)',
  adminOnly: true,
  params: {
    id: { type: 'string', description: 'معرّف السحب shortId (افتراضي: آخر سحب شغّال)', required: false },
  },
  async func({ guild, client }, { id }) {
    try {
      const { endGiveaway } = await import('../utils/giveaway');
      let ref = id ? String(id).trim() : '';
      if (!ref) {
        const { Giveaway } = await import('../models');
        const latest = await Giveaway.findOne({ guildId: guild.id, ended: false }).sort({ createdAt: -1 });
        if (!latest) return { success: false, message: '❌ لا يوجد سحب شغّال' };
        ref = latest.shortId;
      }
      const result = await endGiveaway(client as any, guild.id, ref);
      if (!result.ok) return { success: false, message: `❌ ${result.reason || 'فشل إنهاء السحب'}` };
      return { success: true, message: `🏁 **تم إنهاء السحب** \`${ref}\`\n> ${result.winners?.length ? `الفائزون: ${result.winners.map((w: string) => `<@${w}>`).join('، ')}` : 'بانتظار إعلان الإدارة للفائز يدوياً'}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إنهاء السحب: ${e.message}` };
    }
  },
});

registerTool('giveaway_set_winner', {
  description: 'إعلان فائز سحب يدوياً (الإدارة تختار الفائز)',
  adminOnly: true,
  params: {
    id: { type: 'string', description: 'معرّف السحب (اختياري)', required: false },
    userId: { type: 'string', description: 'آيدي الفائز أو منشنه', required: true },
  },
  async func({ guild, client, defaultTargetUserId }, { id, userId }) {
    const targetId = userId || defaultTargetUserId;
    if (!targetId) return { success: false, message: '❌ منشن الفائز أو مرّر آيديه' };
    const clean = String(targetId).match(/\d{17,20}/)?.[0];
    if (!clean) return { success: false, message: '❌ آيدي العضو غير صالح' };
    try {
      const { addGiveawayWinners } = await import('../utils/giveaway');
      const result = await addGiveawayWinners(client as any, guild.id, id ? String(id).trim() : undefined, [clean]);
      if (!result.ok) return { success: false, message: `❌ ${result.reason || 'فشل إعلان الفائز'}` };
      return { success: true, message: `🏆 **تم إعلان الفائز** <@${clean}>${result.finishedNow ? '\n> (تم إنهاء السحب الآن)' : ''}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل إعلان الفائز: ${e.message}` };
    }
  },
});

registerTool('list_giveaways', {
  description: 'عرض السحوبات في السيرفر',
  adminOnly: false,
  params: { limit: { type: 'number', description: 'العدد (افتراضي 10)', required: false } },
  async func({ guild }, { limit = 10 }) {
    try {
      const { Giveaway } = await import('../models');
      const list = await Giveaway.find({ guildId: guild.id }).sort({ createdAt: -1 }).limit(Math.min(25, Math.max(1, Math.trunc(Number(limit)))));
      if (!list.length) return { success: true, message: '🎁 **لا توجد سحوبات في السيرفر**' };
      return {
        success: true,
        message: `🎁 **السحوبات:**\n` + list.map(g => `• \`${g.shortId}\` — ${g.prize} — ${g.ended ? 'منتهي' : 'شغّال'} — ${g.winnerIds?.length ? `فائز: ${g.winnerIds.map((w: string) => `<@${w}>`).join('، ')}` : 'بدون فائز'}`).join('\n'),
      };
    } catch (e: any) {
      return { success: false, message: `❌ فشل الجلب: ${e.message}` };
    }
  },
});


// --------------------------------------------
// 🤖 حالة البوت
// --------------------------------------------

registerTool('set_bot_status', {
  description: 'تغيير حالة البوت ونشاطه الظاهر (يلزم مالك/مطوّر)',
  adminOnly: true,
  dangerous: true,
  params: {
    status: { type: 'string', description: 'online / idle / dnd / invisible', required: false },
    activity: { type: 'string', description: 'النشاط الظاهر (مثال: يلعب Minecraft)', required: false },
    activityType: { type: 'string', description: 'playing / watching / listening / competing', required: false },
  },
  async func({ client }, { status = 'online', activity, activityType = 'playing' }) {
    try {
      const presence: any = { status: ['online', 'idle', 'dnd', 'invisible'].includes(String(status)) ? status : 'online' };
      if (activity) presence.activities = [{ name: String(activity).slice(0, 128), type: { playing: 0, watching: 3, listening: 2, competing: 5 }[String(activityType)] ?? 0 }];
      client.user?.setPresence(presence);
      return { success: true, message: `🤖 **تم تحديث حالة البوت**${activity ? ` إلى: ${activity}` : ''}` };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تحديث الحالة: ${e.message}` };
    }
  },
});

registerTool('set_bot_avatar', {
  description: 'تغيير صورة البوت العامة (يلزم مالك/مطوّر)',
  adminOnly: true,
  dangerous: true,
  params: { url: { type: 'string', description: 'رابط الصورة', required: false } },
  async func({ client, attachments }, { url }) {
    const source = url || attachments?.find(a => (a.contentType || '').startsWith('image/'))?.url;
    if (!source) return { success: false, message: '❌ مرّر رابط صورة أو أرفق صورة' };
    try {
      const buffer = await fetchImageBuffer(source);
      await client.user?.setAvatar(buffer);
      return { success: true, message: '🖼️ **تم تغيير صورة البوت**' };
    } catch (e: any) {
      return { success: false, message: `❌ فشل تغيير الصورة: ${e.message}` };
    }
  },
});


// --------------------------------------------
// تنفيذ أداة من قبل الـ AI
// --------------------------------------------
export async function executeAITool(
  toolName: string,
  args: any,
  context: ToolContext
): Promise<AIToolResult> {
  const tool = TOOLS[toolName];
  if (!tool) return { success: false, message: `❌ أداة غير موجودة: ${toolName}` };

  // 🎯 ملء userId تلقائياً من الهدف الافتراضي (منشن/رد) إن غاب أو غير صالح
  const rawUserId = typeof args?.userId === 'string' ? args.userId.trim() : '';
  const looksLikeSnowflake = /^\d{17,20}$/.test(rawUserId);
  if ((!rawUserId || !looksLikeSnowflake) && context.defaultTargetUserId) {
    if (['ban_user', 'kick_user', 'timeout_user', 'remove_timeout', 'warn_user', 'unwarn_user', 'give_role', 'remove_role', 'get_user_info', 'voice_mute', 'voice_deafen', 'disconnect_voice', 'set_member_roles'].includes(toolName)) {
      args = { ...(args || {}), userId: context.defaultTargetUserId };
    }
  }
  // 🔎 لو الـ AI مرّر اسم بدل ID (مثل username) — نحاول نلقاه بالاسم في السيرفر
  if (args?.userId && !/^\d{17,20}$/.test(String(args.userId).trim())) {
    const needle = String(args.userId).trim().toLowerCase();
    const byName =
      context.guild.members.cache.find(
        m => m.user.username.toLowerCase() === needle || m.displayName.toLowerCase() === needle
      ) ||
      context.guild.members.cache.find(
        m => m.user.username.toLowerCase().includes(needle) || m.displayName.toLowerCase().includes(needle)
      );
    if (byName) args = { ...args, userId: byName.id };
  }

  // 📍 ملء channelId تلقائياً من القناة الحالية لو غاب أو غير صالح (17-20 رقم ديسكورد)
  const rawChannelId = typeof args?.channelId === 'string' ? args.channelId.trim() : '';
  const looksLikeSnowflakeCh = /^\d{17,20}$/.test(rawChannelId);
  if ((!rawChannelId || !looksLikeSnowflakeCh) && context.defaultChannelId) {
    if (['delete_channel', 'purge_messages', 'create_invite', 'set_system_channel', 'set_afk_channel', 'set_channel_topic', 'rename_channel'].includes(toolName)) {
      args = { ...(args || {}), channelId: context.defaultChannelId };
    }
  }

  // فحص صلاحيات: الأدمن فقط للأدوات adminOnly
  if (tool.adminOnly) {
    const isAdmin = context.executor.permissions.has(PermissionFlagsBits.Administrator) ||
                    context.executor.id === context.guild.ownerId;
    if (!isAdmin) {
      return { success: false, message: '❌ هذه الأداة للإدارة فقط (تحتاج Administrator أو مالك)' };
    }
  }

  // 👑 الأدوات الخطيرة: مالك السيرفر (أو مطوّر البوت) فقط — باقي الإدارة لا يقدر يطلبها إطلاقاً
  if (tool.dangerous) {
    const devId = process.env.DEVELOPER_USER_ID;
    const isOwner = context.executor.id === context.guild.ownerId;
    const isDev = !!devId && context.executor.id === devId;
    if (!isOwner && !isDev) {
      return {
        success: false,
        message: '❌ هذه العملية **خطيرة جداً** — فقط **مالك السيرفر** (أو مطوّر البوت) يستطيع طلبها. أنت غير مخوّل بذلك.',
      };
    }
  }

  // أدوات خطيرة تحتاج تأكيد إضافي
  if (tool.dangerous && !args.confirmed) {
    return { 
      success: false, 
      message: `⚠️ **عملية خطيرة تحتاج تأكيد** — أعد الطلب مع \`"confirmed": true\` في المعاملات`,
      data: { needsConfirmation: true }
    };
  }

  try {
    logger.info(`AI Tool executed: ${toolName} by ${context.executor.user.tag} in ${context.guild.name}`);
    return await tool.func(context, args);
  } catch (e: any) {
    logger.error(`AI Tool ${toolName} error: ${e.message}`);
    return { success: false, message: `❌ خطأ في الأداة: ${e.message}` };
  }
}

// --------------------------------------------
// بناء وصف الأدوات للـ System Prompt
// --------------------------------------------
export function getToolsDescription(): string {
  let desc = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  desc += `[ACTIONS] **قدراتك التنفيذية — نفّذ الأداة مباشرة ولا تقل "سأفعل"**\n`;
  desc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  desc += `استدعاء: كتلة JSON واحدة أو عدة كتل متتالية في نهاية ردك — حتى 20 أداة / 7 جولات:\n`;
  desc += `\`\`\`json\n{"tool":"اسم_الأداة","args":{"المعامل":"القيمة"}}\n\`\`\`\n`;
  desc += `مثال: «اعمل قناة إعلانات وابعت فيها مرحباً» → \`create_channel\` ثم \`send_message\` بنفس الرد.\n\n`;

  const categories: Record<string, string[]> = {
    '🛡️ إدارة/حماية': ['ban_user', 'kick_user', 'timeout_user', 'remove_timeout', 'warn_user', 'unwarn_user', 'unban_user', 'list_bans'],
    '📝 قنوات/رولات': [
      'create_channel', 'delete_channel', 'clone_channel', 'rename_channel', 'set_channel_topic', 'set_slowmode',
      'set_voice_limit', 'set_channel_bitrate', 'move_channel', 'set_nsfw', 'lockdown_server',
      'create_role', 'delete_role', 'clone_role', 'rename_role', 'give_role', 'remove_role', 'set_member_roles',
      'set_role_color', 'set_role_icon', 'set_role_hoist', 'set_role_mentionable', 'set_role_position', 'set_role_permissions', 'set_channel_permissions',
    ],
    '👥 أعضاء/صوت': ['voice_mute', 'voice_deafen', 'disconnect_voice', 'move_member_voice', 'rename_member', 'search_member'],
    '💬 رسائل/ثريدات': [
      'send_message', 'send_embed', 'send_poll', 'send_announcement', 'send_dm', 'edit_message', 'delete_message', 'unpin_message',
      'add_reaction', 'pin_last_message', 'purge_messages', 'create_thread', 'create_forum_post', 'archive_thread', 'delete_thread',
    ],
    '🖼️ إعدادات السيرفر': [
      'set_server_icon', 'remove_server_icon', 'set_server_banner', 'remove_server_banner', 'set_server_splash', 'rename_server',
      'set_server_description', 'set_server_locale', 'set_verification_level', 'set_explicit_content_filter',
      'set_default_notifications', 'set_system_channel', 'set_special_channel', 'set_afk_channel', 'set_afk_timeout',
      'create_template', 'get_audit_logs', 'organize_server', 'prune_members',
    ],
    '😀 إيموجي/ستيكرات': ['create_emoji', 'delete_emoji', 'rename_emoji', 'list_emojis', 'create_sticker', 'delete_sticker', 'list_stickers'],
    '🪝 ويب هوك/دعوات': ['create_webhook', 'list_webhooks', 'delete_webhook', 'send_webhook_message', 'cleanup_webhooks', 'create_invite', 'list_invites', 'delete_all_invites'],
    '📅 أحداث/أوتومود': ['create_event', 'list_events', 'delete_event', 'create_automod_rule', 'list_automod_rules', 'toggle_automod_rule', 'delete_automod_rule'],
    '🎵 موسيقى': ['music_play', 'music_skip', 'music_stop', 'music_pause', 'music_resume', 'music_volume', 'music_shuffle', 'music_leave', 'music_queue'],
    '🎫 تذاكر/سحب': ['open_ticket', 'add_ticket_member', 'claim_ticket', 'close_ticket', 'close_current_ticket', 'giveaway_create', 'giveaway_end', 'giveaway_set_winner', 'list_giveaways'],
    '🤖 البوت': ['set_bot_status', 'set_bot_avatar', 'set_bot_nickname'],
    '📊 معلومات': ['get_server_info', 'get_user_info', 'check_security_status'],
    '⚙️ إعدادات': ['toggle_protection', 'create_backup', 'restore_backup', 'run_security_scan'],
  };

  const line = (t: string): string => {
    const tool = TOOLS[t];
    if (!tool) return '';
    const params = Object.entries(tool.params).map(([k, v]) => `${k}${v.required ? '' : '?'}`).join(',');
    const short = tool.description.length > 30 ? tool.description.slice(0, 29) + '…' : tool.description;
    return `\`${t}\`(${params}) ${short}${tool.dangerous ? ' ⚠️' : ''}${tool.adminOnly ? ' 👑' : ''}\n`;
  };

  const shown = new Set<string>();
  for (const [cat, tools] of Object.entries(categories)) {
    desc += `\n**${cat}:**\n`;
    for (const t of tools) {
      const l = line(t);
      if (!l) continue;
      shown.add(t);
      desc += l;
    }
  }

  // أي أداة جديدة غير مصنّفة تظهر تلقائياً — لا أداة مخفية عن الـ AI
  const uncategorized = Object.keys(TOOLS).filter(t => !shown.has(t));
  if (uncategorized.length) {
    desc += `\n**🧩 أدوات إضافية:**\n`;
    for (const t of uncategorized) desc += line(t);
  }

  desc += `\n**قواعد:**\n`;
  desc += `- 👑 للإدارة فقط | ⚠️ خطر: مالك السيرفر/المطوّر فقط + \`confirmed:true\`\n`;
  desc += `- نفّذ فوراً بلا سؤال تأكيد. المهمة المركّبة = عدة أدوات متتالية.\n`;
  desc += `- **ممنوع** كتابة «تم/✅/تمت/خلصت» قبل استلام نتيجة الأداة الناجحة فعلياً. الفشل يُذكر بصراحة.\n`;
  desc += `- العضو المستهدف من المنشن/الرد تلقائياً — لا تطلب ID. مرّر الأسماء كما هي تُحلّ تلقائياً.\n`;
  desc += `- صورة مرفقة + "حطها صورة للسيرفر" → \`set_server_icon\` بدون url.\n`;

  return desc;
}

export function getAllToolNames(): string[] {
  return Object.keys(TOOLS);
}