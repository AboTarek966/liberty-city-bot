// ============================================
// Omni Bot - Security Name Guard
// كاشف أسماء القنوات/الرولات التخريبية (هاكر / نيوك / اختراق)
// ============================================
// يستخدمه مضاد النيوك لحذف أي قناة أو رول يحمل اسم هجوم أو تخريب
// حتى لو فشلت سجلات التدقيق أو تأخّرت، وحتى لو أنشأها المهاجم باسم مُموّه.

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** تحويل الأرقام/الرموز الشبيهة بالحروف (leetspeak) */
function deLeet(text: string): string {
  return text
    .replace(/0/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g');
}

/**
 * توحيد الاسم: حروف صغيرة + إزالة الزخارف والمسافات الصفرية والتشكيل،
 * ثم تحويل أي رمز/إيموجي إلى مسافة — حتى لا يفلت الاسم المُموّه.
 */
export function normalizeSecurityName(raw: unknown): string {
  return deLeet(
    String(raw ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(ZERO_WIDTH, '')
      .replace(ARABIC_DIACRITICS, '')
  )
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// كلمات كاملة واضحة الدلالة على اختراق/تخريب — لا تشمل كلمات عامة قد تكون مشروعة
// (مثل raid أو spam أو destroy وحدها) حتى لا نحذف قنوات سيرفر عادية بالخطأ.
const MALICIOUS_TOKENS = new Set<string>([
  'nuke', 'nuked', 'nukes', 'nuking', 'nuker', 'nukers',
  'hack', 'hacks', 'hacked', 'hacker', 'hackers', 'hacking',
  'pwn', 'pwns', 'pwned', 'pwner', 'pwners',
  'owned',
  'crack', 'cracks', 'cracked', 'cracker', 'crackers', 'cracking',
  'defaced', 'deface', 'defacer', 'defacement',
  'kly', 'rcl', 'vxl',
  'هكر', 'هكرز', 'هاكر', 'هاكرز', 'مخترق', 'مخترقة', 'مخترقين',
  'اختراق', 'اخترقت', 'اخترق', 'تهكير', 'تهكر', 'منتهك',
  'نيوك', 'نوك', 'منيوك',
  'تخريب', 'تخرب', 'تخربت', 'خرقت', 'خرق',
  'دمر', 'دمرت', 'تدمر', 'تدمير', 'سحق', 'سحقت',
]);

// عبارات تُطابق حتى لو لُصقت الكلمات ببعضها أو حُشيت بين زخارف
const COMPACT_STEMS = [
  'nuked', 'hacked', 'pwned', 'owned', 'cracked', 'defaced',
  'kly', 'rcl', 'vxl',
  'deathnote', 'washere', 'ontop',
  'مخترق', 'اختراق', 'تهكير', 'تخريب', 'تدمير', 'نيوك',
];

/** هل هذا الاسم قناة/رول تخريبية؟ */
export function isMaliciousSecurityName(raw: unknown): boolean {
  const normalized = normalizeSecurityName(raw);
  if (!normalized) return false;

  const tokens = normalized.split(' ');
  if (tokens.some(token => MALICIOUS_TOKENS.has(token))) return true;

  // نسخة ملتصقة: تكشف "NUKED-BY-X" و"『xxnukedxx』" و"DeathNote" وغيرها
  const compact = tokens.join('');
  return COMPACT_STEMS.some(stem => compact.includes(stem));
}
