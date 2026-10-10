// ============================================
// Liberty City Bot - AI Moderation
// أوامر العقوبات باللغة الطبيعية عبر المحادثة
// مثال: "أريدك أن تعطي تايم أوت لهذا العضو @user لمدة 5m"
//
// ⚠️ أمان: التحقق من صلاحيات المستخدم إلزامي قبل أي تنفيذ،
// والتنفيذ حتمي (regex) وليس بقرار الذكاء الاصطناعي.
// ============================================

import { Message, GuildMember, User, PermissionFlagsBits } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';

const logger = createLogger('AIModeration');

type ModerationAction = 'ban' | 'kick' | 'timeout' | 'untimeout' | 'warn';

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
    action: 'warn',
    patterns: /تحذير|إنذار|انذار|(?:^|\W)warn(?:$|\W)/i,
    permission: PermissionFlagsBits.ModerateMembers,
    label: 'تحذير',
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
  if (!message.member.permissions.has(hit.permission)) {
    logger.info(`⛔ Denied: ${message.author.tag} lacks permission for ${hit.action}`);
    await respond(message, `❌ **لا تملك صلاحية** ${hit.label} — هذا الطلب يحتاج صلاحيات إدارية.`);
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

    switch (hit.action) {
      case 'ban': {
        const result = await client.moderationHandler.ban({
          guild,
          moderator,
          target: target.user,
          reason,
        });
        embed = result.embed;
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
        break;
      }
    }

    await respond(message, {
      content: `✅ **تم تنفيذ أمر الـ ${hit.label} بنجاح** — ${target.user}`,
      embeds: [embed],
    });

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
