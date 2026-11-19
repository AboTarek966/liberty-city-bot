// ============================================
// Omni Bot - 💳 اكتشاف تأكيد التحويل بالكريديت من ProBot نفسه
// ============================================
// الإثبات الوحيد للدفع = رسالة تأكيد ProBot نفسها (وليست أمر الدفع الذي كتبه المشتري):
//   مثال: ":moneybag: | username, has transferred `$84210527` to <@134...>"
// يتحقق البوت من:
//   ١) مؤلف الرسالة = ProBot الرسمي (أو ProBot Prime أو معرّفات من PROBOT_BOT_IDS)
//   ٢) الرسالة تدل على تحويل ناجح (وليست فشل/رفض)
//   ٣) نفس المستلم (منشن داخل رسالة ProBot) + نفس المبلغ (من داخل رسالة ProBot)
//   ٤) نفس المشتري (من اسم المرسل المذكور في رسالة ProBot أو من رد ProBot أو من كاش الأمر)
// أمر المشتري في الشات لا يُعتد به إطلاقاً كدفع — لا يؤكد ولا يرسل سؤال للبائع.
// أمر الدفع المكتوب من المشتري يُحفظ فقط في كاش قصير المدى لمساعدة مطابقة المشتري.
// ============================================

import { Message, Guild } from 'discord.js';
import { createLogger } from './helpers';
import { StoreOrder } from '../models';
import { getStore } from './store';
import { fulfillStoreOrder } from './storeFulfill';

const logger = createLogger('ProbotConfirm');

/** تطبيع الأرقام العربية/الفارسية إلى أرقام لاتينية وحذف فواصل الآلاف */
function normalizeDigits(text: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return String(text ?? '').replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

/** محاولة استخراج أمر الدفع من نص رسالة المشتري. يعيد null إذا لم تكن رسالة دفع إطلاقاً. */
export function parseCreditCommand(
  text: string
): { payeeId: string; amount: number } | null {
  try {
    const raw = normalizeDigits(String(text ?? ''));
    const t = raw.trim();
    if (t.length > 120) return null; // المشتري لازم يرسل الأمر وحده
    const match =
      /^\s*(?:#|!|\/|-|\+)?credits?\s+(\d{15,22})\s+(\d[\d\s,،_]{0,20})\s*$/i.exec(t);
    if (!match) return null;
    const payeeId = match[1];
    const amount = Math.floor(Number(match[2].replace(/[,،\s_]/g, '')));
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
      return null;
    }
    return { payeeId, amount };
  } catch {
    return null;
  }
}

/** معرّفات بوتات ProBot المسموح لها بتأكيد التحويل (الرسمي + Prime) + إضافات من البيئة */
const PROBOT_IDS = new Set<string>([
  '282859044593598464', // ProBot الرسمي
  '567703512763334685', // ProBot Prime
  ...String(process.env.PROBOT_BOT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
]);

/** كلمات تدل على تحويل ناجح في رسالة ProBot (مع دعم العربية/الإنجليزية) */
const SUCCESS_MARKERS = [
  'moneybag',           // رسالة ProBot الافتراضية تبدأ بـ :moneybag:
  'has transferred',
  'has transfered',
  'transferred',
  'transfered',
  'transfer successful',
  'transfer completed',
  'تم تحويل',
  'تم التحويل',
  'حوّل',
  'حولت',
  'تحويل بنجاح',
  'تحويل ناجح',
];

/** كلمات تدل على فشل/رفض التحويل — تمنع اعتماد أي رسالة تحملها */
const FAILURE_MARKERS = [
  'fail',
  'insufficient',
  'denied',
  'cannot',
  "can't",
  'error',
  'unable',
  'not enough',
  'فشل',
  'خطأ',
  'لم يتم',
  'لا يوجد',
  'غير كاف',
  'مرفوض',
  'تعذر',
];

/** نص موحد: محتوى الرسالة + كل نصوص الإمبدز داخلها */
function buildTranscript(message: Message): string {
  const parts: string[] = [typeof message.content === 'string' ? message.content : ''];
  for (const embed of (message as any).embeds ?? []) {
    parts.push(embed?.title ?? '', embed?.description ?? '');
    if (embed?.author?.name) parts.push(embed.author.name);
    if (embed?.footer?.text) parts.push(embed.footer.text);
    for (const field of embed?.fields ?? []) {
      parts.push(field?.name ?? '', field?.value ?? '');
    }
  }
  return parts.filter(Boolean).join('\n');
}

/** كل معرّفات المنشن داخل النص (مستلم/باعث/غيرهم) */
function extractMentionIds(text: string): string[] {
  return [...text.matchAll(/<@!?(\d{15,22})>/g)].map((m) => m[1]);
}

/** كل الأرقام داخل النص بعد إزالة المنشنات والرموز الزخرفية — لجمع المبالغ المحتملة */
function extractAmountCandidates(text: string): number[] {
  const normalized = normalizeDigits(text).replace(/<[^>]+>/g, ' ');
  const matches = normalized.match(/\d[\d\s,،_٬]{0,25}\d|\d/g) || [];
  const out: number[] = [];
  for (const raw of matches) {
    const n = Math.floor(Number(raw.replace(/[,،\s_٬]/g, '')));
    if (Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER) out.push(n);
  }
  return [...new Set(out)];
}

/** اسم المرسل المذكور في رسالة ProBot: الجزء قبل ", has transferred" بعد ":moneybag: |" */
function extractSenderName(text: string): string | null {
  const normalized = normalizeDigits(text);
  const afterPipe = normalized.includes('|') ? normalized.split('|').slice(1).join('|') : '';
  const source = afterPipe || normalized;
  const m =
    /([^|,\n]{1,40})[,،]\s*(has\s+transf|transfer|تم)/i.exec(source) ||
    /\|\s*([^|,\n]{1,40})[,،]/i.exec(source);
  const name = m?.[1]?.replace(/[*`_~]/g, '').replace(/#\d{1,6}$/, '').trim();
  return name && name.length >= 2 && name.length <= 40 ? name : null;
}

/** هل تشبه إحدى رسائل نجاح التحويل؟ */
function looksLikeSuccessfulTransfer(text: string): boolean {
  const t = normalizeDigits(text).toLowerCase();
  if (FAILURE_MARKERS.some((w) => t.includes(w.toLowerCase()))) return false;
  return SUCCESS_MARKERS.some((w) => t.includes(w.toLowerCase()));
}

// ---------------------------------------------------------------------------
// كاش قصير المدى لأوامر الدفع التي كتبها المشترون — لا يُعتد به كدفع إطلاقاً،
// يُستخدم فقط للمساعدة في مطابقة "المشتري" عند وصول رسالة تأكيد ProBot.
// ---------------------------------------------------------------------------
interface CreditAttempt {
  authorId: string;
  payeeId: string;
  amount: number;
  at: number;
}

const RECENT_TTL_MS = 10 * 60_000; // ١٠ دقائق
const MAX_ATTEMPTS_PER_CHANNEL = 20;
const recentCreditCommands = new Map<string, CreditAttempt[]>();

/** يُسجّل أمر دفع كتبه مشترٍ (بدون أي اعتماد عليه كدفع) */
export function recordCreditCommandAttempt(message: Message): void {
  try {
    if (!message.guild || message.author.bot || message.webhookId) return;
    const parsed = parseCreditCommand(message.content || '');
    if (!parsed) return;
    const key = message.channelId;
    const now = Date.now();
    const list = (recentCreditCommands.get(key) || []).filter((a) => now - a.at < RECENT_TTL_MS);
    list.push({ authorId: message.author.id, payeeId: parsed.payeeId, amount: parsed.amount, at: now });
    if (list.length > MAX_ATTEMPTS_PER_CHANNEL) list.splice(0, list.length - MAX_ATTEMPTS_PER_CHANNEL);
    recentCreditCommands.set(key, list);
  } catch {
    /* تجاهل */
  }
}

function recentAttemptFor(
  channelId: string,
  predicate: (a: CreditAttempt) => boolean
): CreditAttempt | null {
  const now = Date.now();
  const list = recentCreditCommands.get(channelId);
  if (!list?.length) return null;
  const alive = list.filter((a) => now - a.at < RECENT_TTL_MS);
  if (alive.length !== list.length) recentCreditCommands.set(channelId, alive);
  return alive.find(predicate) ?? null;
}

async function memberNameMatches(guild: Guild, userId: string, senderName: string): Promise<boolean> {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;
    const needle = senderName.trim().toLowerCase();
    const flat = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const needles = [needle, flat(needle)];
    const names = [
      member.user.username,
      member.user.globalName ?? '',
      member.displayName ?? '',
      member.nickname ?? '',
    ].filter(Boolean) as string[];
    return names.some((n) => {
      const nn = n.toLowerCase();
      const nf = flat(n);
      return needles.includes(nn) || needles.includes(nf) || nn.startsWith(needle + '#');
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// المعالج الرئيسي: يُستدعى لكل رسالة بشرية/بوت — يتجاهل إلا رسائل تأكيد ProBot
// ---------------------------------------------------------------------------
export async function handleProbotCreditConfirmation(message: Message): Promise<void> {
  try {
    if (!message.guild) return;
    if (!message.author.bot) return; // رسائل البشر لا تُعتد بها إطلاقاً
    if (message.webhookId) return;
    const authorId = message.author.id;
    if (!PROBOT_IDS.has(authorId)) return; // ليست من بوت ProBot — لا علاقة لنا

    const transcript = buildTranscript(message);
    if (!transcript) return;
    if (!looksLikeSuccessfulTransfer(transcript)) return;

    const mentionIds = extractMentionIds(transcript);
    const repliedUserId = ((message as any).mentions?.repliedUser?.id as string | undefined) ?? null;
    const allIds = new Set<string>([...mentionIds, ...(repliedUserId ? [repliedUserId] : [])]);
    if (allIds.size === 0) return;

    const amountCandidates = extractAmountCandidates(transcript);
    if (!amountCandidates.length) return;

    const store = await getStore(false).catch(() => null);
    const storePayeeId = store?.payeeId ? String(store.payeeId) : null;
    const payeeOf = (o: any): string => String(o?.payeeId || storePayeeId || '');

    // ١) نطاق القناة نفسها (أدق) ثم احتياطياً على مستوى السيرفر
    const queryBase = { status: 'pending' as const, amount: { $in: amountCandidates } };
    let pool = await StoreOrder.find({ ...queryBase, channelId: message.channelId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    if (!pool.length) {
      pool = await StoreOrder.find({ ...queryBase, guildId: message.guild.id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }
    if (!pool.length) return;

    // ٢) تطابق المستلم: المعرّف المذكور في رسالة ProBot لازم يطابق payee للطلب
    pool = pool.filter((o: any) => {
      const p = payeeOf(o);
      return p && allIds.has(p);
    });
    if (!pool.length) return;

    // ٣) تطابق المشتري: من اسم مرسل رسالة ProBot أو من رد ProBot أو من كاش الأمر
    const senderName = extractSenderName(transcript);
    const verified: any[] = [];

    if (repliedUserId) {
      for (const o of pool) if (String(o.buyerId) === repliedUserId) verified.push(o);
    }
    if (senderName) {
      for (const o of pool) {
        if (await memberNameMatches(message.guild, String(o.buyerId), senderName)) verified.push(o);
      }
    }
    for (const o of pool) {
      const attempt = recentAttemptFor(
        message.channelId,
        (a) => a.authorId === String(o.buyerId) && a.amount === o.amount
      );
      if (attempt) verified.push(o);
    }

    const seen = new Set<string>();
    const unique = verified.filter((o) => {
      const id = String(o.orderId);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    let chosen: any = null;
    if (unique.length === 1) {
      chosen = unique[0];
    } else if (unique.length > 1) {
      chosen = [...unique].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )[0];
    } else {
      // لا يوجد مشتري مطابق — لا ننفذ شيئاً وننبّه البائع للمراجعة اليدوية
      const list = pool
        .slice(0, 3)
        .map((o: any) => `#${o.orderId} (${o.projectName})`)
        .join('، ');
      await (message.channel as any)
        .send({
          content:
            `⚠️ وصلت رسالة يؤكدها ProBot بمبلغ أحد طلباتك لكن تعذر مطابقة المشتري تلقائياً — ` +
            `الطلبات المطابقة: ${list}\n` +
            `> أكّد يدوياً بزر «تم التسليم والاستلام» من إيصال الطلب.`,
        })
        .catch(() => {});
      logger.warn(
        `Unmatched ProBot transfer: no buyer match | channel=${message.channelId} | candidates=${list} | sender=${senderName ?? 'unknown'}`
      );
      return;
    }

    const result = await fulfillStoreOrder(message.client, {
      mode: 'auto',
      orderId: String(chosen.orderId),
      guild: message.guild,
      actorLabel: 'probot',
      notifyLog: true,
    });
    if (!result.claimed) return;

    await (message.channel as any)
      .send({
        content:
          `🤖 **اكتُشفت رسالة تأكيد ProBot فعلياً** — <@${chosen.buyerId}>\n` +
          `> 🧾 الطلب **#${chosen.orderId}** — **${chosen.projectName}**\n` +
          `> ✅ تم التحقق من رسالة ProBot (المشتري + المستلم + المبلغ) — تم تأكيد الدفع وإتمام التسليم`,
      })
      .catch(() => {});
  } catch (error: any) {
    logger.warn(`probot confirmation handler error: ${error?.message || error}`);
  }
}
