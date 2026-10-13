// ============================================
// Liberty City Bot - AI Moderation
// أوامر العقوبات باللغة الطبيعية عبر المحادثة
// مثال: "أريدك أن تعطي تايم أوت لهذا العضو @user لمدة 5m"
//
// ⚠️ أمان: التحقق من صلاحيات المستخدم إلزامي قبل أي تنفيذ،
// والتنفيذ حتمي (regex) وليس بقرار الذكاء الاصطناعي.
// ============================================

import { Message, Guild, GuildMember, User, PermissionFlagsBits, EmbedBuilder, ChannelType, TextChannel, ColorResolvable } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';
import { getGuildSettings } from '../models';
import { Colors } from '../utils/embeds';

const logger = createLogger('AIModeration');

type ModerationAction = 
  'ban' | 'kick' | 'timeout' | 'untimeout' | 'warn' | 'unwarn' |
  'role_create' | 'role_delete' | 'role_add' | 'role_remove' | 'promote' | 'jail' | 'lockdown' | 'sequential_warn';

interface ActionDef {
  action: ModerationAction;
  patterns: RegExp;
  permission: bigint;
  label: string;
}

// ⚠️ الترتيب مهم: "رفع الكتم" يجب أن يُفحص قبل "كتم"
const ACTIONS: ActionDef[] = [
  {
    action: 'untimeout',
    patterns:
      /رفع\s*الكتم|رفع\s*الميوت|إلغاء\s*الكتم|الغاء\s*الكتم|فك\s*الكتم|فك\s*الميوت|unmute|untimeout|remove\s*(?:the\s*)?timeout/i,
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'رفع الكتم',
  },
  {
    action: 'timeout',
    patterns: /تايم\s*أ?وت|كتم|كتمان|ميوت|إكتم|timeout|\bmute\b/i,
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'كتم (تايم أوت)',
  },
  {
    action: 'ban',
    patterns: /حظر|باند?|(?:^|\W)ban(?:$|\W)/i,
    permission: PermissionFlagsBits.BanMembers,
    label: 'حظر',
  },
  {
    action: 'kick',
    patterns: /طرد|(?:^|\W)kick(?:$|\W)/i,
    permission: PermissionFlagsBits.KickMembers,
    label: 'طرد',
  },
  {
    action: 'unwarn',
    patterns: /(?:شيل|ازل|احذف|إزالة|امسح|لغي| remove)\s*(?:ال)?(?:تحذير|\d)|(?:حذف|إزالة|ازالة|مسح)\s*تحذير|(?:^|\W)unwarn(?:$|\W)/i,
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'إزالة تحذير',
  },
  // ⚠️ التسلسلي (يحتوي رقم) يجب أن يُفحص قبل التحذير العادي
  {
    action: 'sequential_warn',
    patterns: /تحذير\s*[١٢٣123]/i,
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'تحذير تسلسلي (1/2/3)',
  },
  {
    action: 'sequential_warn',
    patterns: /(?:^|\s)(?:ت|تح|تحذ)\s*[123١٢٣]\b/i,
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'اختصار تحذير تسلسلي (ت 1/2/3)',
  },
  {
    action: 'warn',
    patterns: /تحذير|إنذار|انذار|(?:^|\W)warn(?:$|\W)/i,
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'تحذير',
  },
  // ========== أوامر إدارة السيرفر الجديدة ==========
  {
    action: 'role_create',
    patterns: /إنشاء\s*رول|انشاء\s*رول|عمل\s*رول|اضافة\s*رول|create\s*role|make\s*role/i,
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إنشاء رول',
  },
  {
    action: 'role_delete',
    patterns: /حذف\s*رول|مسح\s*رول|إزالة\s*رول|delete\s*role|remove\s*role/i,
    permission: PermissionFlagsBits.ManageRoles,
    label: 'حذف رول',
  },
  {
    action: 'role_add',
    patterns: /اعطِ?\s*رول|أضف\s*رول|اعطاء\s*رول|اعطِ?\s*دور|اعطِ?\s* رتبه|اعطِ?\s*رتبة|give\s*role|add\s*role|grant\s*role/i,
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إضافة رول لعضو',
  },
  {
    action: 'role_remove',
    patterns: /أزل\s*رول|إزالة\s*رول|حذف\s*رول\s*من|سحب\s*رول|مسح\s*رول\s*من|remove\s*role|take\s*role/i,
    permission: PermissionFlagsBits.ManageRoles,
    label: 'إزالة رول من عضو',
  },
  {
    action: 'promote',
    patterns: /ترقيه|ترقية|رقِ?ه|رقى|promote|upgrade\s*role/i,
    permission: PermissionFlagsBits.ManageRoles,
    label: 'ترقية عضو',
  },
  {
    action: 'jail',
    patterns: /سجن|حبس|عزل|jail|put\s*in\s*jail/i,
    permission: PermissionFlagsBits.ManageRoles | PermissionFlagsBits.ManageChannels,
    label: 'سجن عضو',
  },
  {
    action: 'lockdown',
    patterns: /طوارئ|اقفال|اقفال\s*السيرفر|اقفال\s*الكل|lockdown|lock\s*server/i,
    permission: PermissionFlagsBits.Administrator,
    label: 'وضع الطوارئ',
  },
];

// نفي: "لا تحظر" / "don't ban" → لا تنفيذ، يُترك للذكاء الاصطناعي يرد عادياً
const NEGATION =
  /لا\s+ت?(?:حظر|كتم|طرد|نبه|عطي|زد|تعطي)|don'?t\s+(?:ban|kick|timeout|mute|warn)|do\s+not\s+(?:ban|kick|timeout|mute|warn)/i;

// --------------------------------------------
// استخراج المدة بالمللي ثانية (عربي + مختصر)
// --------------------------------------------
function extractDurationMs(text: string): number | null {
  const UNITS: Record<string, number> = {
    ثانية: 1000, ثوان: 1000,
    دقيقة: 60000, دقائق: 60000, دقيقه: 60000,
    ساعة: 3600000, ساعات: 3600000,
    يوم: 86400000, أيام: 86400000, ايام: 86400000,
  };

  // مثنى: دقيقتين / ساعتين / يومين
  const dual = text.match(/دقيقتين|ساعتين|يومين/);
  if (dual) {
    if (dual[0].startsWith('دقيق')) return 2 * 60000;
    if (dual[0].startsWith('ساع')) return 2 * 3600000;
    return 2 * 86400000;
  }

  // عدد + وحدة عربية
  const ar = text.match(
    /(\d{1,3})\s*(ثانية|ثوان|دقيقة|دقائق|دقيقه|ساعة|ساعات|يوم|أيام|ايام)/
  );
  if (ar) return parseInt(ar[1], 10) * UNITS[ar[2]];

  // صيغة مختصرة إنجليزية: 5m / 10m / 2h / 1d / 30s
  const en = text.match(/(\d{1,3})\s*(s|m|h|d)\b/i);
  if (en) {
    const factor: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(en[1], 10) * factor[en[2].toLowerCase()];
  }

  return null;
}

// --------------------------------------------
// تحديد الهدف (منشن أو الرد على رسالة عضو)
// --------------------------------------------
async function resolveTarget(
  message: Message,
  client: LibertyClient
): Promise<{ user: User; member?: GuildMember } | null> {
  const guild = message.guild!;

  // 1) منشن مباشر (مع تجاهل منشن البوت نفسه)
  const mentioned =
    message.mentions.users.find(u => u.id !== client.user?.id) ||
    message.mentions.users.first();
  if (mentioned) {
    const member =
      guild.members.cache.get(mentioned.id) ||
      (await guild.members.fetch(mentioned.id).catch(() => null));
    return { user: mentioned, member: member || undefined };
  }

  // 2) الرد على رسالة عضو آخر ("هذا العضو" مع رد)
  if (message.reference?.messageId) {
    const ref = await message.channel.messages
      .fetch(message.reference.messageId)
      .catch(() => null);
    if (ref && ref.author.id !== client.user?.id && !ref.author.bot) {
      const member =
        guild.members.cache.get(ref.author.id) ||
        (await guild.members.fetch(ref.author.id).catch(() => null));
      return { user: ref.author, member: member || undefined };
    }
  }

  return null;
}

// --------------------------------------------
// استخراج السبب (يتبقى بعد إزالة المنشن والمدة)
// --------------------------------------------
function extractReason(question: string): string {
  let reason = question
    .replace(/<@!?\d{17,20}>/g, ' ')
    .replace(/للمدة|لمدة|لمده|لـمدة/g, ' ')
    .replace(/\d{1,3}\s*(s|m|h|d)\b/gi, ' ')
    .replace(/\d{1,3}\s*(ثانية|ثوان|دقيقة|دقائق|دقيقه|ساعة|ساعات|يوم|أيام|ايام)/g, ' ')
    .replace(/دقيقتين|ساعتين|يومين/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (reason.length < 3) return 'طلب عقوبة عبر المحادثة';
  return reason.substring(0, 400);
}

// --------------------------------------------
// رد مرن (فشل الرد → إرسال في القناة مع تسجيل)
// --------------------------------------------
async function respond(
  message: Message,
  payload: string | { content?: string; embeds: any[] }
): Promise<void> {
  const body = typeof payload === 'string' ? { content: payload } : payload;
  try {
    await message.reply(body);
    return;
  } catch (error: any) {
    logger.warn(`Reply failed (${error.message}) — falling back to channel.send`);
  }
  try {
    if (message.channel.isTextBased() && 'send' in message.channel) {
      const fallback =
        typeof payload === 'string'
          ? { content: `<@${message.author.id}> ${payload}` }
          : { content: `<@${message.author.id}>`, ...payload };
      await message.channel.send(fallback);
    }
  } catch (error: any) {
    logger.error(`Fallback send failed: ${error.message}`);
  }
}

// --------------------------------------------
// ⚠️ تحذير تسلسلي (1/2/3) — يُستخدم من مسار الـ AI ومن الاختصارات (ت2 @user)
// ينشئ التحذيرات حتى المستوى المطلوب ثم يطبّق رول المستوى المقابل
// --------------------------------------------
const ADMIN_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageEmojisAndStickers,
  PermissionFlagsBits.ManageWebhooks,
];

export async function runSequentialWarn(opts: {
  guild: Guild;
  moderator: GuildMember;
  targetMember: GuildMember;
  level: number;
  reason: string;
}): Promise<string> {
  const { guild, moderator, targetMember, level, reason } = opts;

  // النظام التسلسلي للإداريين فقط
  const isOwner = targetMember.id === guild.ownerId;
  const isAdminTarget = isOwner || ADMIN_PERMISSIONS.some(p => targetMember.permissions.has(p));
  if (!isAdminTarget) {
    throw new Error('رول التحذير التسلسلي للإداريين فقط — للأعضاء العاديين اكتب بدون رقم (مثل: ت @العضو)');
  }

  const { applySequentialAdminWarnRoles } = await import('../utils/warnRoles');
  const { Warning, getNextCaseId } = await import('../models');
  const settings = await getGuildSettings(guild.id);

  // نضاعف التحذيرات حتى نبلغ المستوى المطلوب
  const currentCount = await Warning.countDocuments({ guildId: guild.id, userId: targetMember.id });
  for (let i = currentCount; i < level; i++) {
    await Warning.create({
      guildId: guild.id,
      userId: targetMember.id,
      moderatorId: moderator.id,
      reason: reason || `تحذير تسلسلي رقم ${i + 1}`,
      caseId: await getNextCaseId(guild.id),
    });
  }

  const seqDiag: Record<string, any> = {};
  const roleResult = await applySequentialAdminWarnRoles({
    settings,
    guild,
    executor: moderator,
    target: targetMember,
    reason: reason || `تحذير تسلسلي رقم ${level}`,
    forceFreshSettings: true,
    diag: seqDiag,
  });

  if (!roleResult) {
    const seq = settings?.warnRoles?.adminSequential;
    const diag = JSON.stringify({ seq, ...seqDiag });
    logger.warn(`sequential_warn failed. level=${level} diag=${diag}`);
    throw new Error(`لا يوجد رول تحذير رقم ${level} مُعد — راجع /settings → 🎭 رولات التحذير | diagnostics: ${diag}`);
  }

  const newCount = await Warning.countDocuments({ guildId: guild.id, userId: targetMember.id });
  return `⚠️ تحذير تسلسلي رقم ${level} (المجموع: ${newCount}) | ${roleResult}`;
}

// --------------------------------------------
// المدخل الرئيسي: يعيد true إذا تم تنفيذ/معالجة أمر عقوبة
// --------------------------------------------
export async function executeAIModeration(
  message: Message,
  client: LibertyClient,
  question: string
): Promise<boolean> {
  if (!message.guild || !message.member) return false;

  // 1) كشف نية العقوبة
  const hit = ACTIONS.find(a => a.patterns.test(question));
  if (!hit) return false;

  // 2) نفي ("لا تحظر") → لا تنفيذ، يُترك للرد العادي
  if (NEGATION.test(question)) {
    logger.info(`Negation detected — skipping action | user=${message.author.tag}`);
    return false;
  }

  logger.info(
    `🎯 Moderation intent: ${hit.action} | by ${message.author.tag} | "${question.substring(0, 80)}"`
  );

  // 3) تحديد الهدف
  const target = await resolveTarget(message, client);
  if (!target) {
    await respond(
      message,
      '⚠️ **منشن العضو** الذي تريد تنفيذ العقوبة عليه في رسالتك، مثال:\n' +
        '`أريدك أن تعطي كتم لهذا العضو` + منشن + `لمدة 5m`'
    );
    return true;
  }

  // 4) التحقق من صلاحيات المستخدم (إلزامي!)
  // 🔓 أوامر الرولات (إعطاء/سحب/ترقية) = فحص تسلسل هرمي فقط:
  //    المالك أو الأدمن أو رتبتك أعلى من رتبة الهدف — بدون ManageRoles
  const hierarchyActions = ['role_add', 'role_remove', 'promote'];
  let allowed: boolean;
  if (hierarchyActions.includes(hit.action)) {
    const targetMember =
      target.member || (await message.guild.members.fetch(target.user.id).catch(() => null));
    const isOwner = message.guild.ownerId === message.author.id;
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
    allowed =
      isOwner ||
      isAdmin ||
      (!!targetMember && message.member.roles.highest.position > targetMember.roles.highest.position);
  } else {
    allowed = message.member.permissions.has(hit.permission);
  }
  if (!allowed) {
    logger.info(`⛔ Denied: ${message.author.tag} lacks permission for ${hit.action}`);
    await respond(message, `❌ **لا تملك صلاحية** ${hit.label} — رتبتك ليست أعلى من رتبة الهدف.`);
    return true;
  }

  // 5) لا عقوبة على النفس
  if (target.user.id === message.author.id) {
    await respond(message, '❌ لا يمكنك تنفيذ عقوبة على نفسك.');
    return true;
  }

  // 6) المدة (إلزامية للكتم)
  let durationMs: number | null = null;
  if (hit.action === 'timeout') {
    durationMs = extractDurationMs(question);
    if (!durationMs || durationMs <= 0) {
      await respond(
        message,
        '⏱️ **حدد مدة الكتم** — مثال: `5m` أو `10 دقائق` أو `ساعة` أو `يومين`'
      );
      return true;
    }
    if (durationMs > 28 * 24 * 60 * 60 * 1000) {
      await respond(message, '❌ المدة القصوى هي **28 يوماً**.');
      return true;
    }
  }

  const reason = extractReason(question);
  const guild = message.guild;
  const moderator = message.member;

  // 7) التنفيذ
  try {
    let embed: any;
    let msg: string | null = null; // ✅ رد نصي سطر واحد بدل الإيمبد الكبير

    switch (hit.action) {
      case 'ban': {
        const result = await client.moderationHandler.ban({
          guild,
          moderator,
          target: target.user,
          reason,
        });
        embed = result.embed;
        msg = result.simpleMsg;
        break;
      }
      case 'kick': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');
        const result = await client.moderationHandler.kick({
          guild,
          moderator,
          target: member,
          reason,
        });
        embed = result.embed;
        msg = result.simpleMsg;
        break;
      }
      case 'timeout': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');
        if (!member.moderatable)
          throw new Error('لا أستطيع كتم هذا العضو — تأكد أن رتبتي أعلى من رتبته');
        const result = await client.moderationHandler.timeout({
          guild,
          moderator,
          target: member,
          reason,
          duration: `${durationMs}ms`,
        });
        embed = result.embed;
        msg = result.simpleMsg;
        break;
      }
      case 'untimeout': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');
        const result = await client.moderationHandler.removeTimeout({
          guild,
          moderator,
          target: member,
          reason,
        });
        embed = result.embed;
        msg = result.simpleMsg;
        break;
      }
      case 'warn': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        const result = await client.moderationHandler.warn({
          guild,
          moderator,
          target: member || target.user,
          reason,
        });
        embed = result.embed;
        msg = result.simpleMsg;
        break;
      }
      case 'unwarn': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');

        // 🔢 "شيل 2 @admin" ← رقم مستوى التحذير
        const lvl = question.match(/(?:شيل|ازل|احذف|إزالة|امسح|لغي| remove)\s*([١-٩1-9])/i);
        if (lvl) {
          const level = parseInt(lvl[1]
            .replace('١', '1').replace('٢', '2').replace('٣', '3').replace('٤', '4')
            .replace('٥', '5').replace('٦', '6').replace('٧', '7').replace('٨', '8')
            .replace('٩', '9'), 10);
          const { removeWarnToLevel } = await import('../utils/warnRoles');
          msg = await removeWarnToLevel({ guild, moderator, target: member, level, reason });
          break;
        }

        const result = await client.moderationHandler.unwarn({
          guild,
          moderator,
          target: member || target.user,
          reason,
        });
        embed = result.embed;
        msg = result.simpleMsg;
        break;
      }
      case 'sequential_warn': {
        // استخراج الرقم من "تحذير 1" أو "ت 1" أو "تح 2" أو "تحذ 3" إلخ
        let match = question.match(/تحذير\s*([١٢٣123])/i);
        if (!match) {
          match = question.match(/(?:ت|تح|تحذ)\s*([١٢٣123])\b/i);
        }
        const level = match ? parseInt(match[1].replace('١', '1').replace('٢', '2').replace('٣', '3'), 10) : 1;

        const targetMember = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!targetMember) throw new Error('العضو غير موجود في السيرفر');

        msg = await runSequentialWarn({ guild, moderator, targetMember, level, reason });
        break;
      }
      // ========== أوامر إدارة السيرفر الجديدة ==========
      case 'role_create': {
        const roleName = question.match(/رول\s+(?:اسمه|اسمه\s*)?([^ل]+?)(?:\s+بلون|\s*$)/i)?.[1]?.trim() || 'رول جديد';
        const colorMatch = question.match(/لون\s*(?:#?[0-9a-fA-F]{6})/i);
        const color = colorMatch ? colorMatch[0].replace(/لون\s*/i, '') : '#5865F2';
        
        const newRole = await guild.roles.create({
          name: roleName.substring(0, 100),
          color: color as ColorResolvable,
          reason: `${reason} | بواسطة ${moderator.user.tag}`,
        });
        
        embed = new EmbedBuilder()
          .setTitle('✅ تم إنشاء الرول')
          .setColor(Colors.success)
          .addFields(
            { name: '🎭 الرول', value: `${newRole}`, inline: true },
            { name: '🎨 اللون', value: color, inline: true },
            { name: '🛡️ المنفذ', value: `${moderator.user.tag}`, inline: true },
          )
          .setTimestamp();
        msg = `✅ تم إنشاء الرول **${newRole.name}**`;
        break;
      }
      case 'role_delete': {
        const role = message.mentions.roles.first() || 
          guild.roles.cache.find(r => r.name.toLowerCase().includes(question.replace(/حذف\s*رول|مسح\s*رول|إزالة\s*رول|delete\s*role/i, '').trim().toLowerCase()));
        if (!role) throw new Error('لم يتم العثور على الرول — منشن الرول أو اكتب اسمه');
        
        if (role.managed) throw new Error('لا يمكن حذف رول مدار (بوتات/تكاملات)');
        if (role.position >= guild.members.me!.roles.highest.position) 
          throw new Error('رتبة البوت يجب أن تكون أعلى من الرول المراد حذفه');
        
        await role.delete(`${reason} | بواسطة ${moderator.user.tag}`);
        
        embed = new EmbedBuilder()
          .setTitle('🗑️ تم حذف الرول')
          .setColor(Colors.error)
          .addFields(
            { name: '🎭 الرول', value: role.name, inline: true },
            { name: '🛡️ المنفذ', value: `${moderator.user.tag}`, inline: true },
          )
          .setTimestamp();
        msg = `🗑️ تم حذف الرول **${role.name}**`;
        break;
      }
      case 'role_add': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');
        
        const role = message.mentions.roles.first() || 
          guild.roles.cache.find(r => r.name.toLowerCase().includes(question.replace(/اعطِ?\s*رول|أضف\s*رول|اعطاء\s*رول|give\s*role|add\s*role/i, '').trim().toLowerCase()));
        if (!role) throw new Error('لم يتم العثور على الرول — منشن الرول أو اكتب اسمه');
        
        if (member.roles.cache.has(role.id)) throw new Error('العضو يملك هذا الرول بالفعل');
        if (role.position >= guild.members.me!.roles.highest.position)
          throw new Error('رتبة البوت يجب أن تكون أعلى من الرول المضاف');
        
        const isOwner = message.author.id === guild.ownerId;
        const executorMember = message.member as GuildMember;
        if (!isOwner && executorMember.roles.highest.comparePositionTo(role) <= 0)
          throw new Error('رتبتك يجب أن تكون أعلى من الرول المضاف');
        
        await member.roles.add(role, `${reason} | بواسطة ${moderator.user.tag}`);
        
        embed = new EmbedBuilder()
          .setTitle('➕ تم إضافة الرول')
          .setColor(Colors.success)
          .addFields(
            { name: '👤 العضو', value: `${member}`, inline: true },
            { name: '🎭 الرول', value: `${role}`, inline: true },
            { name: '🛡️ المنفذ', value: `${moderator.user.tag}`, inline: true },
          )
          .setTimestamp();
        msg = `➕ ${member} ← ${role}`;
        break;
      }
      case 'role_remove': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');
        
        const role = message.mentions.roles.first() || 
          guild.roles.cache.find(r => r.name.toLowerCase().includes(question.replace(/أزل\s*رول|إزالة\s*رول|سحب\s*رول|remove\s*role/i, '').trim().toLowerCase()));
        if (!role) throw new Error('لم يتم العثور على الرول — منشن الرول أو اكتب اسمه');
        
        if (!member.roles.cache.has(role.id)) throw new Error('العضو لا يملك هذا الرول أصلاً');
        if (role.position >= guild.members.me!.roles.highest.position)
          throw new Error('رتبة البوت يجب أن تكون أعلى من الرول المراد إزالته');
        
        const isOwner = message.author.id === guild.ownerId;
        const executorMember = message.member as GuildMember;
        if (!isOwner && executorMember.roles.highest.comparePositionTo(role) <= 0)
          throw new Error('رتبتك يجب أن تكون أعلى من الرول المراد إزالته');
        
        await member.roles.remove(role, `${reason} | بواسطة ${moderator.user.tag}`);
        
        embed = new EmbedBuilder()
          .setTitle('➖ تم إزالة الرول')
          .setColor(Colors.warning)
          .addFields(
            { name: '👤 العضو', value: `${member}`, inline: true },
            { name: '🎭 الرول', value: `${role}`, inline: true },
            { name: '🛡️ المنفذ', value: `${moderator.user.tag}`, inline: true },
          )
          .setTimestamp();
        msg = `➖ ${member} ← ${role} (تمت الإزالة)`;
        break;
      }
      case 'promote': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');
        
        const botTopRole = guild.members.me!.roles.highest;
        const executorTopRole = (message.member as GuildMember).roles.highest;
        const memberTopRole = member.roles.highest;
        const isOwner = message.author.id === guild.ownerId;
        
        const higherRoles = guild.roles.cache
          .filter(r => 
            r.position > memberTopRole.position &&
            r.position < botTopRole.position &&
            r.id !== guild.id &&
            !r.managed
          )
          .filter(r => isOwner || r.position <= executorTopRole.position)
          .sort((a, b) => a.position - b.position);
        
        if (higherRoles.size === 0) throw new Error('لا يوجد رول أعلى متاح للترقية');
        
        const newRole = higherRoles.first()!;
        await member.roles.add(newRole, `${reason} | بواسطة ${message.author.tag}`);
        
        embed = new EmbedBuilder()
          .setTitle('⬆️ تم ترقية العضو')
          .setColor(Colors.success)
          .addFields(
            { name: '👤 العضو', value: `${member}`, inline: true },
            { name: '🎭 الرول الجديد', value: `${newRole}`, inline: true },
            { name: '🛡️ المنفذ', value: `${message.author.tag}`, inline: true },
          )
          .setTimestamp();
        msg = `⬆️ ${member} ← ${newRole}`;
        break;
      }
      case 'jail': {
        const member = target.member || (await guild.members.fetch(target.user.id).catch(() => null));
        if (!member) throw new Error('العضو غير موجود في السيرفر');
        
        const settings = await getGuildSettings(guild.id);
        let jailChannel = message.mentions.channels.first();
        if (!jailChannel && settings.jail?.channelId) {
          jailChannel = guild.channels.cache.get(settings.jail.channelId) as TextChannel;
        }
        if (!jailChannel) throw new Error('لم يتم تحديد روم السجن — منشن الروم أو اضبطه في الإعدادات');
        
        let jailRole = guild.roles.cache.find(r => r.name === '🔒 جايـل' || r.name === 'Jail');
        if (!jailRole) {
          jailRole = await guild.roles.create({
            name: '🔒 جايـل',
            color: 0x555555,
            reason: 'رول السجن التلقائي',
            permissions: [],
          });
        }
        
        if (member.roles.cache.has(jailRole.id)) throw new Error('العضو مسجون بالفعل');
        if (jailRole.position >= guild.members.me!.roles.highest.position)
          throw new Error('رتبة البوت يجب أن تكون أعلى من رول السجن');
        
        // Save current roles
        const currentRoles = member.roles.cache
          .filter(r => r.id !== guild.id && r.id !== jailRole.id)
          .map(r => r.id);
        
        await member.roles.add(jailRole, `${reason} | بواسطة ${message.author.tag}`);
        
        // Apply channel overwrites
        const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice);
        for (const channel of channels.values()) {
          if (channel.id === jailChannel.id) continue;
          if ('permissionOverwrites' in channel) {
            try {
              await channel.permissionOverwrites.edit(jailRole, { ViewChannel: false, SendMessages: false, Connect: false }, { reason: `سجن ${member.user.tag}` });
            } catch {}
          }
        }
        
        // Allow in jail channel
        try {
          if ('permissionOverwrites' in jailChannel) {
            await jailChannel.permissionOverwrites.edit(jailRole, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }, { reason: `سجن ${member.user.tag}` });
          }
        } catch {}
        
        // Save jail data
        const { JailData } = await import('../models');
        await JailData.findOneAndUpdate(
          { guildId: guild.id, userId: member.id },
          { guildId: guild.id, userId: member.id, previousRoles: currentRoles, jailRoleId: jailRole.id, jailedBy: message.author.id, reason, jailedAt: new Date(), jailChannelId: jailChannel.id },
          { upsert: true }
        );
        
        embed = new EmbedBuilder()
          .setTitle('🔒 تم سجن العضو')
          .setColor(Colors.error)
          .addFields(
            { name: '👤 العضو', value: `${member}`, inline: true },
            { name: '🔒 روم السجن', value: `${jailChannel}`, inline: true },
            { name: '🛡️ المنفذ', value: `${message.author.tag}`, inline: true },
          )
          .setTimestamp();
        msg = `🔒 ${member} تم سجنه في ${jailChannel}`;
        break;
      }
      case 'lockdown': {
        const state = question.includes('إلغاء') || question.includes('إيقاف') || question.includes('off') ? false : true;
        
        if (state) {
          const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice);
          for (const channel of channels.values()) {
            if ('permissionOverwrites' in channel) {
              try {
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, Connect: false }, { reason: `Lockdown by ${message.author.tag}` });
              } catch {}
            }
          }
          embed = new EmbedBuilder()
            .setTitle('🔒 تم تفعيل وضع الطوارئ')
            .setColor(Colors.error)
            .setDescription('تم قفل جميع القنوات — لا يستطيع الأعضاء إرسال رسائل أو دخول الغرف الصوتية');
          msg = '🔒 تم تفعيل وضع الطوارئ — كل القنوات مقفلة';
        } else {
          const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice);
          for (const channel of channels.values()) {
            if ('permissionOverwrites' in channel) {
              try {
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null, Connect: null }, { reason: `Lockdown removed by ${message.author.tag}` });
              } catch {}
            }
          }
          embed = new EmbedBuilder()
            .setTitle('🔓 تم إلغاء وضع الطوارئ')
            .setColor(Colors.success)
            .setDescription('تم فتح جميع القنوات — عاد الأعضاء للكتابة والدخول');
          msg = '🔓 تم إلغاء وضع الطوارئ — القنوات مفتوحة';
        }
        break;
      }
    }

    await respond(message, msg || `✅ **تم تنفيذ أمر الـ ${hit.label} بنجاح** — ${target.user}`);

    logger.info(
      `✅ AI-Moderation executed: ${hit.action} on ${target.user.id} by ${message.author.id}`
    );
    return true;
  } catch (error: any) {
    logger.error(`AI-Moderation failed (${hit.action}): ${error.message}`);
    await respond(message, `❌ **فشل التنفيذ:** ${error.message}`);
    return true;
  }
}
