// ============================================
// 👑 بوابة موافقة المالك — إطفاء الحماية بموافقة صاحب التاج
//    خيار جديد في الإعدادات ← الحماية: "موافقة المالك 👑"
//    • مفعّل (الافتراضي): أي محاولة إطفاء حماية (من اللوحة أو /protection)
//      تُرسل طلباً لمالك السيرفر (صاحب تاج الملكية) — يوافق ✅ فيُطفى فوراً،
//      أو يرفض ❌ فتبقى الحماية. لا شيء يُطفى بدون نقرته.
//    • المالك يطفى بنفسه مباشرة (هو صاحب التاج أصلاً).
//    • 🛠️ مطوّر البوت (DEVELOPER_USER_ID) يطفى بنفسه أيضاً ويملك أزرار
//      الموافقة ✅/❌ — المالك والمطوّر هما الأساسيان وحدهما.
//    • من يقدّرون "طلب" الإطفاء: المالك + المطوّر فقط.
//      🚫 الوايت ليست لم تعد تمنح أي حق — لا طلب ولا موافقة.
//      (إن لم يكن DEVELOPER_USER_ID مضبوطاً يُسمح لمن عنده صلاحية
//      الإعدادات أن يطلب — لكن الموافقة تبقى للمالك/المطوّر.)
// ============================================

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, User } from 'discord.js';

/** أسماء الميزات للعرض في رسائل الطلب والموافقة */
export const PROTECTION_LABELS: Record<string, string> = {
  ownerApproval: 'خيار موافقة المالك 👑',
  antiRaid: 'مضاد الرويد 🛡️',
  antiSpam: 'مضاد السبام 🚫',
  antiLink: 'مضاد الروابط 🔗',
  antiInvite: 'مضاد الدعوات 📨',
  antiMention: 'مضاد المنشنز 📣',
  antiCaps: 'مضاد الكابس 🔠',
  antiEmoji: 'مضاد الإيموجي 😀',
  antiNuke: 'مضاد النيوك 💣',
  antiBot: 'مضاد البوتات 🤖',
  antiAdmin: 'مراقبة الأدمن ⚠️',
  autoBackup: 'النسخ التلقائي 💾',
  autoScan: 'الفحص الدوري 🔍',
  inviteTracker: 'تتبع الدعوات 📬',
  aiAutoMod: 'الأوتو مود الذكي 🤖',
  lockdown: 'وضع الطوارئ 🔒',
};

interface PendingApproval {
  field: string;
  requestedBy: string; // معرّف المطلِب
  requestedByTag: string;
  expires: number;
}

/** الطلبات المعلّقة — في الذاكرة (إعادة التشغيل تلغيها = الحماية تبقى مفعّلة = آمن) */
const PENDING = new Map<string, PendingApproval>();
const TTL_MS = 5 * 60 * 1000; // 5 دقائق

/** الخيار مفعّل ما لم يُعطَّل صراحة — undefined = مفعّل (آمن افتراضياً) */
export function approvalEnabled(settings: any): boolean {
  return settings?.protection?.ownerApproval !== false;
}

/** من يقدّرون "طلب" إطفاء الحماية (الموافقة نفسها للمالك وحده) */
export function canRequestProtectionOff(settings: any, guild: Guild, userId: string): boolean {
  if (guild.ownerId === userId) return true; // 👑 المالك (التاج)
  const devId = process.env.DEVELOPER_USER_ID;
  if (devId && userId === devId) return true; // 🛠️ مطوّر البوت
  // 🚫 الوايت ليست لا تمنح أي حق طلب — الجميع متساوٍ
  // البيئة غير مضبوطة (لم يُحدَّد DEVELOPER_USER_ID) → نسمح لمن عنده صلاحية الإعدادات أن يطلب
  // (الحدّ الفعلي دائمًا هو نقرة المالك — لا شيء يُطفى بدون التاج 👑)
  if (!devId) return true;
  return false;
}

/**
 * بوابة "إطفاء الحماية" — تُستدعى قبل تطبيق أي إطفاء.
 * تُعيد: null → مسموح بالتطبيق الفوري · نص → مُنع أو أُرسل طلب للمالك (لا يُطبَّق شيء).
 */
export async function gateProtectionOff(opts: {
  settings: any;
  guild: Guild;
  user: User;
  channel: any;
  field: string;
}): Promise<string | null> {
  if (!approvalEnabled(opts.settings)) return null; // الخيار مطفأ → إطفاء مباشر (القديم)
  if (opts.guild.ownerId === opts.user.id) return null; // 👑 المالك يطفى بنفسه
  const devEnv = process.env.DEVELOPER_USER_ID;
  if (devEnv && opts.user.id === devEnv) return null; // 🛠️ المطوّر يطفى بنفسه (المالك والمطوّر الأساسيان)

  if (!canRequestProtectionOff(opts.settings, opts.guild, opts.user.id)) {
    return '⛔ إطفاء الحماية محصور بمالك السيرفر 👑 والمطوّر فقط';
  }

  const label = PROTECTION_LABELS[opts.field] || opts.field;
  const sent = await requestOwnerApproval({
    guild: opts.guild,
    channel: opts.channel,
    field: opts.field,
    requestedBy: opts.user,
  });

  return sent === 'sent'
    ? `👑 أُرسل طلب إيقاف **${label}** إلى مالك السيرفر${devEnv ? ' والمطوّر' : ''} — **لن يُطفى شيء قبل الموافقة** (أزرار ✅/❌ لمدة 5 دقائق)`
    : '❌ تعذّر إرسال الطلب للمالك (لا توجد صلاحية إرسال في هذه القناة)';
}

/** إرسال رسالة الطلب للمالك (منشن + أزرار موافقة/رفض) */
export async function requestOwnerApproval(opts: {
  guild: Guild;
  channel: any;
  field: string;
  requestedBy: User;
}): Promise<'sent' | 'nochannel'> {
  const key = `${opts.guild.id}:${opts.field}`;
  const label = PROTECTION_LABELS[opts.field] || opts.field;

  const embed = new EmbedBuilder()
    .setTitle('👑 طلب إطفاء الحماية')
    .setDescription(
      `**${opts.requestedBy.tag}** يطلب إيقاف **${label}**.\n\n` +
        `اضغط ✅ **موافقة** لتطبيق الإيقاف فوراً، أو ❌ **رفض** لإبقاء الحماية.\n` +
        `⏰ صالح لمدة5 دقائق — بعدها يُلغى الطلب تلقائياً.`
    )
    .setColor(0xf1c40f);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ownappr:yes:${opts.field}`)
      .setLabel('موافقة')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`ownappr:no:${opts.field}`)
      .setLabel('رفض')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  const ch = opts.channel;
  if (!ch || typeof ch.send !== 'function') return 'nochannel';

  PENDING.set(key, {
    field: opts.field,
    requestedBy: opts.requestedBy.id,
    requestedByTag: opts.requestedBy.tag,
    expires: Date.now() + TTL_MS,
  });

  try {
    const devEnv = process.env.DEVELOPER_USER_ID;
    await ch.send({
      content: `<@${opts.guild.ownerId}>${devEnv ? ` <@${devEnv}>` : ''}`, // منشن المالك (+ المطوّر إن وُجد)
      allowedMentions: { parse: ['users'] },
      embeds: [embed],
      components: [row],
    });
    return 'sent';
  } catch {
    PENDING.delete(key); // فشل الإرسال → لا طلب معلّق
    return 'nochannel';
  }
}

/** استخراج الطلب (مرة واحدة فقط + انتهاء الصلاحية) */
export function takePending(guildId: string, field: string): PendingApproval | null {
  const key = `${guildId}:${field}`;
  const p = PENDING.get(key);
  if (!p) return null;
  PENDING.delete(key);
  if (p.expires < Date.now()) return null; // منتهي → يُعتبر غير موجود
  return p;
}
