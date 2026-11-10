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
  description: 'إنشاء قناة نصية أو صوتية أو فئة',
  adminOnly: true,
  params: {
    name: { type: 'string', description: 'اسم القناة', required: true },
    type: { type: 'string', description: 'النوع: text / voice / category', required: true },
    parentId: { type: 'string', description: 'آيدي الفئة الأب (اختياري)', required: false },
    topic: { type: 'string', description: 'وصف القناة (للنصية)', required: false },
  },
  async func({ guild, client, executor }, { name, type, parentId, topic }) {
    const channelType = type === 'voice' ? ChannelType.GuildVoice : type === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText;
    try {
      client.securityHandler?.noteSelfCreatedName(guild.id, 'channel', name);
      const channel = await guild.channels.create({
        name,
        type: channelType,
        parent: parentId || null,
        topic: channelType === ChannelType.GuildText ? topic : undefined,
        reason: `${executor.user.tag}: ${name}`,
      });
      client.securityHandler?.noteSelfCreated(guild.id, 'channel', channel.id);
      return { success: true, message: `✅ **تم إنشاء** ${channelType === ChannelType.GuildVoice ? '🔊' : channelType === ChannelType.GuildCategory ? '📁' : '📝'} **${name}**`, data: { channelId: channel.id } };
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
    if (['ban_user', 'kick_user', 'timeout_user', 'remove_timeout', 'warn_user', 'unwarn_user', 'give_role', 'remove_role', 'get_user_info'].includes(toolName)) {
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
  desc += `[ACTIONS] **قدراتك التنفيذية — تستطيع فعل هذه الأشياء فعلياً**\n`;
  desc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  desc += `عندما يريد المستخدم فعل شيء، **لا تقل "سأفعل" أو "يمكنك فعل كذا"** — **نفّذ الأداة مباشرة** وقل "تم".\n`;
  desc += `استدعاء الأداة: اكتب في نهاية ردك سطراً واحداً:\n`;
  desc += `\`\`\`json\n{"tool": "اسم_الأداة", "args": {"المعامل": "القيمة"}}\n\`\`\`\n`;
  desc += `ثم ستحصل على النتيجة وتكمل إجابتك.\n\n`;

  const categories: Record<string, string[]> = {
    '🛡️ إدارة/حماية': ['ban_user', 'kick_user', 'timeout_user', 'remove_timeout', 'warn_user', 'unwarn_user'],
    '📝 قنوات/رولات': ['create_channel', 'delete_channel', 'create_role', 'delete_role', 'give_role', 'remove_role', 'rename_channel', 'set_channel_topic', 'rename_role'],
    '🖼️ إعدادات السيرفر': ['set_server_icon', 'remove_server_icon', 'set_server_banner', 'remove_server_banner', 'rename_server', 'set_verification_level', 'set_explicit_content_filter', 'set_default_notifications', 'set_system_channel', 'set_afk_channel', 'create_invite', 'delete_all_invites', 'prune_members'],
    '📊 معلومات': ['get_server_info', 'get_user_info', 'check_security_status'],
    '⚙️ إعدادات': ['toggle_protection', 'create_backup', 'restore_backup', 'run_security_scan'],
    '🗑️ تنظيف': ['purge_messages'],
    '📢 تواصل': ['send_announcement'],
  };

  for (const [cat, tools] of Object.entries(categories)) {
    desc += `\n**${cat}:**\n`;
    for (const t of tools) {
      const tool = TOOLS[t];
      const params = Object.entries(tool.params).map(([k, v]) => `${k}${v.required ? '' : '?'}: ${v.type}`).join('، ');
      desc += `- \`${t}\`(${params}) — ${tool.description}${tool.dangerous ? ' ⚠️' : ''}${tool.adminOnly ? ' 👑' : ''}\n`;
    }
  }

  desc += `\n⚠️ **قواعد مهمة:**\n`;
  desc += `- أدوات 👑 = للإدارة فقط (تحتاج Administrator/مالك)\n`;
  desc += `- أدوات ⚠️ = خطيرة — **مالك السيرفر (أو مطوّر البوت) فقط**، وتحتاج \`"confirmed": true\` في المعاملات\n`;
  desc += `- **نفّذ فوراً** لما يطلب المستخدم — ما تسأله "أتأكد؟" ولا "أعمل؟"\n`;
  desc += `- **السيرفر كله بيديك:** أي تغيير يطلبه المستخدم في السيرفر (صورة السيرفر، البانر، الاسم، التحقق، الفلاتر، قناة النظام، AFK، الدعوات، الحذف غير النشط...) عنده أداة جاهزة — نفّذها مباشرة بنفّذ ولا ترفض.\n`;
  desc += `- **العضو المستهدف:** إذا ظهر في رسالة المستخدم "منشن" أو "رد" لعضو، فهو الهدف تلقائياً — استخدم userId المُعطى في سياق المستخدم ولا تطلب ID أبداً.\n`;
  desc += `- **الرولات/القنوات/الأعضاء:** مرّر roleId/channelId أو الاسم بالضبط — تُحلّ تلقائياً.\n`;
  desc += `- ![مرفق صورة مع الطلب]: لو المستخدم أرفق صورة وقال "حطها صورة للسيرفر" — استخدم \`set_server_icon\` بدون url (الصورة المرفقة تُلتقط تلقائياً).\n`;
  desc += `- إذا نجحت: قل "تم ✅" + ملخص مختصر\n`;
  desc += `- إذا فشلت: قل السبب وجرب بديل لو ممكن\n`;

  return desc;
}

export function getAllToolNames(): string[] {
  return Object.keys(TOOLS);
}