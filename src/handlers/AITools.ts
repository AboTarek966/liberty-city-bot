// ============================================
// Liberty City Bot - AI Tools / Function Calling
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
} from 'discord.js';
import { LibertyClient } from './../LibertyClient';
import { getGuildSettings, ModerationCase } from '../models';
import { createLogger } from '../utils/helpers';

const logger = createLogger('AITools');

export interface AIToolResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface ToolContext {
  guild: Guild;
  executor: GuildMember; // العضو اللي طلب (المستخدم)
  client: LibertyClient;
  reason?: string;
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
  async func({ guild, executor }, { userId, reason, deleteMessageSeconds = 0 }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود في السيرفر' };
    
    if (!target.bannable) return { success: false, message: '❌ لا أستطيع حظر هذا العضو (رتبته أعلى مني أو لديه صلاحيات)' };
    if (target.id === executor.id) return { success: false, message: '❌ لا تستطيع حظر نفسك' };
    if (target.id === guild.ownerId) return { success: false, message: '❌ لا تستطيع حظر مالك السيرفر' };

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
  async func({ guild, executor }, { userId, reason }) {
    const target = await guild.members.fetch(userId).catch(() => null);
    if (!target) return { success: false, message: '❌ العضو غير موجود في السيرفر' };
    if (!target.kickable) return { success: false, message: '❌ لا أستطيع طرد هذا العضو' };
    if (target.id === executor.id) return { success: false, message: '❌ لا تستطيع طرد نفسك' };
    if (target.id === guild.ownerId) return { success: false, message: '❌ لا تستطيع طرد مالك السيرفر' };

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
  async func({ guild, executor }, { name, type, parentId, topic }) {
    const channelType = type === 'voice' ? ChannelType.GuildVoice : type === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText;
    try {
      const channel = await guild.channels.create({
        name,
        type: channelType,
        parent: parentId || null,
        topic: channelType === ChannelType.GuildText ? topic : undefined,
        reason: `${executor.user.tag}: ${name}`,
      });
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
  async func({ guild, executor }, { name, color, hoist, mentionable, permissions }) {
    try {
      const role = await guild.roles.create({
        name,
        color: color || '#5865F2',
        hoist: hoist ?? false,
        mentionable: mentionable ?? false,
        permissions: permissions ? BigInt(permissions) : undefined,
        reason: `${executor.user.tag}: ${name}`,
      });
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
    const role = guild.roles.cache.get(roleId);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (role.managed) return { success: false, message: '❌ لا يمكن إعطاء رول مُدار' };
    if (member.roles.cache.has(roleId)) return { success: false, message: 'ℹ️ العضو يملك الرول بالفعل' };

    try {
      await member.roles.add(role, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `➕ **أُعطي** <@${userId}> **${role.name}**`, data: { userId, roleId } };
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
    const role = guild.roles.cache.get(roleId);
    if (!member) return { success: false, message: '❌ العضو غير موجود' };
    if (!role) return { success: false, message: '❌ الرول غير موجود' };
    if (!member.roles.cache.has(roleId)) return { success: false, message: 'ℹ️ العضو لا يملك الرول' };

    try {
      await member.roles.remove(role, `${executor.user.tag}: ${reason}`);
      return { success: true, message: `➖ **أُزيل** ${role.name} **من** <@${userId}>`, data: { userId, roleId } };
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
// تنفيذ أداة من قبل الـ AI
// --------------------------------------------
export async function executeAITool(
  toolName: string,
  args: any,
  context: ToolContext
): Promise<AIToolResult> {
  const tool = TOOLS[toolName];
  if (!tool) return { success: false, message: `❌ أداة غير موجودة: ${toolName}` };

  // فحص صلاحيات: الأدمن فقط للأدوات adminOnly
  if (tool.adminOnly) {
    const isAdmin = context.executor.permissions.has(PermissionFlagsBits.Administrator) ||
                    context.executor.id === context.guild.ownerId;
    if (!isAdmin) {
      return { success: false, message: '❌ هذه الأداة للإدارة فقط (تحتاج Administrator أو مالك)' };
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
    '📝 قنوات/رولات': ['create_channel', 'delete_channel', 'create_role', 'delete_role', 'give_role', 'remove_role'],
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
  desc += `- أدوات ⚠️ = خطيرة — تحتاج \`"confirmed": true\` في المعاملات\n`;
  desc += `- **نفّذ فوراً** لما يطلب المستخدم — ما تسأله "أتأكد؟" ولا "أعمل؟"\n`;
  desc += `- إذا نجحت: قل "تم ✅" + ملخص مختصر\n`;
  desc += `- إذا فشلت: قل السبب وجرب بديل لو ممكن\n`;

  return desc;
}

export function getAllToolNames(): string[] {
  return Object.keys(TOOLS);
}