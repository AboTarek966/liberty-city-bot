// ============================================
// Omni Bot - 🧠 كاشف الإساءة (عربي/إنجليزي)
// ============================================
// مصمم ليقاوم التمويه: التشكيل، التطويل، المسافات بين الحروف،
// الرموز الفاصلة (ك.س.م.ك)، تكرار الحروف (كسسسسمك)،
// الأرقام البديلة (sh1t)، الحروف الفارسية (ک/ی)، والهمزات.
//
// المبدأ: تطبيع عدواني + جذور إهانة (كلمات/عبارات) + قائمة صريحة
// للسب الذي يُعدّ موجهًا للبوت حتى بدون منشن.

/** نتيجة الكشف */
export interface AbuseMatch {
  /** الكلمة/العبارة كما وردت في القاموس */
  term: string;
  /** الشكل بعد التطبيع */
  normalized: string;
  kind: 'arabic' | 'english' | 'phrase';
}

// --------------------------------------------
// التطبيع
// --------------------------------------------

const AR_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const TATWEEL = /\u0640/g;

/** حذف منشنات Discord والإيموجيات المخصّصة حتى لا تتحول أرقامها إلى حروف */
function stripDiscordTokens(text: string): string {
  return String(text || '')
    .replace(/<a?:\w{1,32}:\d{15,22}>/g, ' ')
    .replace(/<@[!&]?\d{15,22}>/g, ' ')
    .replace(/<#\d{15,22}>/g, ' ');
}

/** توحيد الحروف العربية (همزات/ياء/تاء مربوطة/فارسية) */
function unifyArabic(s: string): string {
  return s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[کڪ]/g, 'ك')
    .replace(/[یے]/g, 'ي')
    .replace(/ؤ/g, 'و');
}

/** أرقام عربية/فارسية → لاتينية */
function unifyDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

/** حروف لاتينية شائعة داخل كلمة عربية (كsمك) → الحرف العربي المقابل */
const LATIN_LOOKALIKE: Record<string, string> = {
  a: 'ا', b: 'ب', c: 'ك', d: 'د', e: 'ي', f: 'ف', g: 'ج', h: 'ه',
  i: 'ي', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', o: 'و', p: 'ب',
  q: 'ق', r: 'ر', s: 'س', t: 'ت', u: 'و', v: 'ف', w: 'و', x: 'كس',
  y: 'ي', z: 'ز',
};

/**
 * الكلمات المختلطة (عربي + لاتيني) غالباً تكون تمويهاً: "كsمك" / "kسمك".
 * نحوّل الحروف اللاتينية فيها إلى أقرب حرف عربي، مع ترك الكلمات اللاتينية
 * الخالصة كما هي (حتى يظل Omni/Bot قابلاً للتعرّف).
 */
function foldMixedScriptWords(s: string): string {
  return s
    .split(' ')
    .map((word) => {
      if (!/[a-z]/.test(word) || !/[\u0600-\u06FF]/.test(word)) return word;
      return word.replace(/[a-z]/g, (ch) => LATIN_LOOKALIKE[ch] ?? ch);
    })
    .join(' ');
}

/** تقليل أي حرف مكرر مرتين أو أكثر إلى حرف واحد (كسسسمك → كسمك) */
export function collapseRepeats(s: string): string {
  return String(s || '').replace(/(.)\1+/gu, '$1');
}

/** تطبيع عربي عدواني: يحافظ على المسافات لكن ينظّفه */
export function normalizeArabic(text: string): string {
  let t = stripDiscordTokens(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(AR_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(ZERO_WIDTH, '');
  t = unifyDigits(t);
  t = unifyArabic(t);
  // رموز شائعة تُستخدم للتمويه
  t = t
    .replace(/\$/g, 'س')
    .replace(/@/g, 'ا');
  // خلط الحروف (كsمك / kسمك) → حروف عربية قبل حذف الرموز
  t = foldMixedScriptWords(t);
  // أي رمز/ترقيم → مسافة (يكشف ك-س-م-ك)
  t = t.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  // ضغط تكرار الحروف: كسسسسمك → كسمك
  t = t.replace(/(.)\1{2,}/gu, '$1');
  return t.replace(/\s+/g, ' ').trim();
}

/** تطبيع إنجليزي مع leetspeak (sh1t → shit) */
export function normalizeEnglish(text: string): string {
  let t = stripDiscordTokens(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(ZERO_WIDTH, '');
  t = unifyDigits(t);
  // استبدال leet قبل حذف الرموز (وإلا تضيع @ و $ و ! و |)
  t = t
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
    .replace(/[!|]/g, 'i')
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/7/g, 't')
    .replace(/5/g, 's');
  t = t.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  t = t.replace(/(.)\1{2,}/gu, '$1');
  return t.replace(/\s+/g, ' ').trim();
}

/** هل النص مكتوب برسائل مفردة بينها مسافات/رموز؟ (ك س م ك / f u c k) */
function isLetterSpaced(tokens: string[]): boolean {
  const singles = tokens.filter((t) => t.length === 1).length;
  if (singles >= 3) return true;
  if (tokens.length >= 2 && tokens.every((t) => t.length <= 2)) return true;
  return false;
}

/** أدوات مساعدة: توكنز + نسخة ملتصقة لكشف "ك س م ك" */
function arabicParts(text: string): {
  tokens: string[];
  compact: string;
  collapsedCompact: string;
  spaced: boolean;
} {
  const norm = normalizeArabic(text);
  const tokens = norm.split(' ').filter(Boolean);
  const compact = tokens.join('');
  return {
    tokens,
    compact,
    collapsedCompact: collapseRepeats(compact),
    spaced: isLetterSpaced(tokens),
  };
}

/** أدوات مساعدة للتطبيع الإنجليزي */
function englishParts(text: string): {
  tokens: string[];
  compact: string;
  collapsedCompact: string;
  spaced: boolean;
} {
  const norm = normalizeEnglish(text);
  const tokens = norm.split(' ').filter(Boolean);
  const compact = tokens.join('');
  return {
    tokens,
    compact,
    collapsedCompact: collapseRepeats(compact),
    spaced: isLetterSpaced(tokens),
  };
}

// --------------------------------------------
// القاموس
// --------------------------------------------

interface Term {
  /** الكلمة بعد التطبيع */
  text: string;
  /** هل نسمح بأن تبدأ الكلمة بالجذر (لجذور طويلة مميزة) */
  prefix?: boolean;
}

// إهانات عربية (جذور/كلمات) — التطبيع يشيل التشكيل والهمزات مسبقاً
const ARABIC_TERMS: Term[] = [
  // سب صريح
  { text: 'كسمك' }, { text: 'كسمكم' }, { text: 'كسمه' }, { text: 'كسم', prefix: true },
  { text: 'كس' }, { text: 'كس امك' }, { text: 'كس اختك' }, { text: 'كس اخوك' }, { text: 'كس ابوك' },
  { text: 'كسختك' }, { text: 'كسخت' }, { text: 'كسام' },
  { text: 'انيك' }, { text: 'نايك' }, { text: 'نيك' }, { text: 'منيك' },
  { text: 'منيوك', prefix: true }, { text: 'متناك', prefix: true }, { text: 'منايك' },
  { text: 'شرموط', prefix: true }, { text: 'شراميط' }, { text: 'شرموطه' },
  { text: 'عرص' }, { text: 'معرص' }, { text: 'عرصه' },
  { text: 'خول' }, { text: 'خولات' }, { text: 'متخول' },
  { text: 'قحبه' }, { text: 'قحاب' }, { text: 'قحب' },
  { text: 'طيز' }, { text: 'طيزي' }, { text: 'طيزك' }, { text: 'طيزه' },
  { text: 'زبي' }, { text: 'زبك' }, { text: 'زبر' },
  { text: 'لبوه' },
  { text: 'ديوث' }, { text: 'ديوس' }, { text: 'قواد' }, { text: 'قواده' },
  { text: 'عاهر' }, { text: 'عاهره' },
  { text: 'زاني' }, { text: 'زانيه' },
  // ابن/ولد ...
  { text: 'ابن الكلب' }, { text: 'ابن كلب' },
  { text: 'ابن الحرام' }, { text: 'ابن القحبه' }, { text: 'ابن الشرموطه' },
  { text: 'ابن المتناكه' }, { text: 'ابن العاهر' }, { text: 'ابن الزنا' },
  { text: 'ابن الوسخه' }, { text: 'ابن الوسخ' },
  { text: 'ولد الكلب' }, { text: 'ولد كلب' }, { text: 'ولد الحرام' }, { text: 'ولد الزنا' },
  { text: 'يا ابن الكلب' }, { text: 'يا ابن الحرام' },
  // شتائم عامة
  { text: 'كلب' }, { text: 'كلاب' }, { text: 'كلبه' },
  { text: 'حمار' }, { text: 'حمير' }, { text: 'حماره' },
  { text: 'حيوان' }, { text: 'بهيم' }, { text: 'بهيمه' },
  { text: 'بغل' }, { text: 'جحش' }, { text: 'خنزير' }, { text: 'قرد' },
  { text: 'غبي' }, { text: 'غبيه' }, { text: 'اغبي' }, { text: 'غباء' },
  { text: 'اهبل' }, { text: 'هبل' }, { text: 'مهبول' },
  { text: 'متخلف' }, { text: 'معتوه' }, { text: 'معوق' }, { text: 'منغولي' },
  { text: 'عبيط' }, { text: 'عبطه' }, { text: 'ابله' }, { text: 'تافه' },
  { text: 'سخيف' }, { text: 'فاشل' }, { text: 'حقير' }, { text: 'وسخ', prefix: true },
  { text: 'قذر' }, { text: 'معفن' }, { text: 'مقرف' }, { text: 'مقزز' },
  { text: 'خسيس' }, { text: 'سافل' }, { text: 'وضيع' }, { text: 'منحط' },
  { text: 'زباله' }, { text: 'قمامه' }, { text: 'زفت' }, { text: 'خرا' }, { text: 'خره' },
  { text: 'نصاب' }, { text: 'حرامي' }, { text: 'سارق' }, { text: 'محتال' },
  { text: 'كداب' }, { text: 'كذاب' }, { text: 'مزعج' }, { text: 'غثيث' },
  { text: 'مهرج' }, { text: 'مسخره' }, { text: 'مجنون' },
  { text: 'بائس' }, { text: 'تعيس' }, { text: 'قبيح' }, { text: 'دنيء' }, { text: 'دني' },
  { text: 'صايع' }, { text: 'هامل' }, { text: 'شاذ' }, { text: 'شاذه' }, { text: 'شواذ' },
  { text: 'زب' }, { text: 'ناك' },
  // لعن/تهديد/طرد
  { text: 'يلعن', prefix: true }, { text: 'ملعون' }, { text: 'لعنه' },
  { text: 'انقلع' }, { text: 'اخرس' }, { text: 'اسكت' }, { text: 'اختف' },
  { text: 'روح موت' },
  { text: 'اقتل نفسك' }, { text: 'انتحر' }, { text: 'اذبح نفسك' },
  { text: 'تفو' }, { text: 'عيب عليك' },
];

// إهانات إنجليزية (سيتم مطابقتها بعد leetspeak)
const ENGLISH_TERMS: Term[] = [
  { text: 'fuck', prefix: true }, { text: 'fuk', prefix: true }, { text: 'phuck', prefix: true },
  { text: 'shit', prefix: true }, { text: 'bullshit' },
  { text: 'bitch', prefix: true }, { text: 'bastard' }, { text: 'cunt' }, { text: 'whore' },
  { text: 'slut' }, { text: 'motherfuck', prefix: true }, { text: 'asshole' },
  { text: 'dickhead' }, { text: 'pussy' }, { text: 'retard' }, { text: 'dick' },
  { text: 'moron', prefix: true }, { text: 'idiot', prefix: true }, { text: 'stupid', prefix: true },
  { text: 'dumbass' }, { text: 'dumb' }, { text: 'loser' }, { text: 'pathetic' },
  { text: 'trash' }, { text: 'garbage' }, { text: 'useless' }, { text: 'worthless' },
  { text: 'kys' }, { text: 'stfu' }, { text: 'shut up' }, { text: 'kill yourself' },
  { text: 'go die' }, { text: 'fuck you' }, { text: 'fuck off' },
  { text: 'faggot', prefix: true }, { text: 'nigger', prefix: true }, { text: 'nigga' },
  { text: 'scam' }, { text: 'scammer' }, { text: 'fraud' }, { text: 'fake' },
  { text: 'ripoff' }, { text: 'suck' }, { text: 'annoying' }, { text: 'worst' },
  { text: 'terrible' }, { text: 'horrible' }, { text: 'awful' }, { text: 'lame' },
  { text: 'crap' }, { text: 'jerk' }, { text: 'mf' },
  // Arabizi / Franco-Arabic الشائع في الشتائم
  { text: 'ksmk' }, { text: 'ksmak' }, { text: 'kosomk' }, { text: 'kosmk' },
  { text: 'kossomk' }, { text: 'kossmk' }, { text: 'kosomak' },
  { text: 'sharmoot' }, { text: 'sharmout' }, { text: 'sharmouta' }, { text: 'sharmota' },
  { text: 'metnak' }, { text: 'metnaka' }, { text: 'matnak' }, { text: 'matnaka' },
  { text: 'khawal' }, { text: 'khawwal' }, { text: 'manyak' }, { text: 'manyouk' },
  { text: 'manyook' }, { text: 'mnayek' }, { text: 'gahba' }, { text: 'gahaba' },
  { text: 'zift' }, { text: 'teez' }, { text: 'tiz' }, { text: 'teezak' },
  { text: 'zeby' }, { text: 'zebi' }, { text: 'zebak' }, { text: 'zebk' },
  { text: 'ya kalb' }, { text: 'ya kelb' }, { text: 'ya homar' }, { text: 'ya hmar' },
  { text: 'ya haywan' }, { text: 'ya ghabi' }, { text: 'ya ghaby' },
  { text: 'ibn el kalb' }, { text: 'ebn el kalb' }, { text: 'ibn el kelb' },
  { text: 'ebn el kelb' }, { text: 'ibn klb' }, { text: 'ebn klb' },
];

/**
 * عبارات آمنة تحتوي كلمات حيوانات — تُزال قبل الفحص حتى لا نصنّف
 * "كلب الحراسة" أو "حمار وحشي" كإساءة.
 */
const BENIGN_ANIMAL_RE =
  /(^|\s)(كلب|كلاب|حمار)\s+(?:ال)?(?:حراسه|حراسة|صيد|بيت|جيران|وحشي)(\s|$)/gu;

function stripBenignCompounds(normalizedArabicText: string): string {
  // النص وصل مطبّعاً مسبقاً (الحراسة ← الحراسه)
  return normalizedArabicText.replace(BENIGN_ANIMAL_RE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Arabizi/Franco: شتائم مكتوبة بحروف لاتينية وأرقام (3ars / 7mar / 5awal).
 * نفحصها بنص "خام منسّق" يحتفظ بالأرقام، لأن التطبيع الإنجليزي يحوّل 3 إلى e.
 */
const ARABIZI_TERMS = [
  '3ars', '3ers', '3rs', '3aher', '3ahra', '3ahera',
  '5awal', '5wal', '5awwal', '5ara', '5ra',
  '7mar', '7omar', '7aywan', '7aiwan',
  '2ahba', '2ahbe', '2ahaba',
  'ksmk', 'ksmak', 'kosomk', 'kosmk', 'kossomk', 'kossmk',
  'sharmoot', 'sharmout', 'sharmouta', 'sharmota',
  'metnak', 'metnaka', 'manyak', 'manyouk', 'mnayek',
  'ya 3ars', 'ya 3aher', 'ya 5awal', 'ya 7mar', 'ya 7omar', 'ya 2ahba',
];

const ARABIZI_HARD_SLURS = [
  '3ars', '3ers', '3aher', '5awal', '5wal', '5ara', '5ra',
  '7mar', '7omar', '7aywan', '2ahba', '2ahbe',
  'ksmk', 'ksmak', 'kosomk', 'kosmk', 'kossomk', 'kossmk',
  'sharmoot', 'sharmout', 'sharmouta', 'sharmota',
  'metnak', 'metnaka',
  'ya 3ars', 'ya 3aher', 'ya 5awal', 'ya 7mar', 'ya 2ahba',
];

/** تطبيع "خام": حروف وأرقام فقط (يحافظ على Arabizi) */
function looseNormalize(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(ZERO_WIDTH, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** مطابقة عبارات Arabizi ككلمات كاملة (مع تجاهل تكرار الحروف) */
function matchLooseTerm(text: string, terms: string[]): string | null {
  const norm = looseNormalize(text);
  if (!norm) return null;
  const padded = ` ${norm} `;
  const collapsed = ` ${norm.split(' ').map(collapseRepeats).join(' ')} `;
  for (const term of terms) {
    const t = looseNormalize(term);
    if (!t) continue;
    if (padded.includes(` ${t} `) || collapsed.includes(` ${t} `)) return term;
  }
  return null;
}

// ترتيب القاموس من الأطول للأقصر: النتيجة الأدق أولاً (كس امك قبل كس)
const SORTED_ARABIC_TERMS = [...ARABIC_TERMS].sort(
  (a, b) => normalizeArabic(b.text).length - normalizeArabic(a.text).length
);
const SORTED_ENGLISH_TERMS = [...ENGLISH_TERMS].sort(
  (a, b) => normalizeEnglish(b.text).length - normalizeEnglish(a.text).length
);

/** قائمة صريحة: وجودها وحده يجعل الرسالة "موجهة للبوت" */
export const HARD_SLURS: string[] = [
  'كسمك', 'كسمكم', 'كس امك', 'كس اختك', 'كس اخوك', 'كس ابوك',
  'انيك', 'نايك', 'نيك', 'منيك', 'منيوك', 'منايك', 'متناك',
  'شرموط', 'شرموطه', 'شراميط', 'عرص', 'معرص', 'خول', 'خولات',
  'قحبه', 'قحاب', 'طيز', 'طيزك', 'زبي', 'زبك', 'زبر',
  'ديوث', 'قواد', 'عاهر', 'عاهره', 'زاني', 'زانيه', 'لبوه',
  'ابن الكلب', 'ابن كلب', 'ابن الحرام', 'ابن القحبه', 'ابن الشرموطه',
  'ابن المتناكه', 'ابن العاهر', 'ابن الزنا', 'ابن الوسخه', 'ابن الوسخ',
  'ولد الكلب', 'ولد كلب', 'ولد الحرام', 'ولد الزنا',
  'يا كلب', 'يا حمار', 'يا حيوان', 'يا خول', 'يا عرص', 'يا شرموط', 'يا قحبه',
  'fuck', 'fuk', 'motherfuck', 'fuckyou', 'asshole', 'bitch', 'bastard', 'cunt',
  'whore', 'slut', 'kys', 'kill yourself', 'retard', 'faggot', 'nigger', 'nigga',
  'shut up', 'stfu',
  // Arabizi
  'ksmk', 'ksmak', 'kosomk', 'kosmk', 'kossomk', 'kossmk', 'kosomak',
  'sharmoot', 'sharmout', 'sharmouta', 'sharmota',
  'metnak', 'metnaka', 'khawal', 'khawwal', 'gahba', 'gahaba',
  'ya kalb', 'ya kelb', 'ibn el kalb', 'ebn el kalb', 'ibn klb', 'ebn klb',
];

/**
 * ما يُعتبر "سباً صريحاً" حتى بدون منشن/ردّ.
 * العربية والأرابيزي الصريحة فقط — بدون الإنجليزية، لأن الشتائم الإنجليزية
 * قد تكون لكلام عام غير موجه للبوت (وتُكتشف عادةً عند المنشن/الردّ).
 */
const ENGLISH_ONLY_SLURS = new Set([
  'fuck', 'fuk', 'motherfuck', 'fuckyou', 'asshole', 'bitch', 'bastard', 'cunt',
  'whore', 'slut', 'kys', 'kill yourself', 'retard', 'faggot', 'nigger', 'nigga',
  'shut up', 'stfu',
]);
const STANDALONE_SLURS = HARD_SLURS.filter((t) => !ENGLISH_ONLY_SLURS.has(t));

// --------------------------------------------
// المطابقة
// --------------------------------------------

/** نسخ الكلمة التي نحتمل أن تكون تحويراً (يا/ال/و + لواحق + تكرار) */
function tokenVariants(token: string): Set<string> {
  const out = new Set<string>([token, collapseRepeats(token)]);

  const prefixes: Array<[string, number]> = [
    ['يا', 2], ['وال', 2], ['بال', 2], ['فال', 2], ['ال', 2],
    ['و', 3], ['ف', 3], ['ب', 3],
  ];
  for (const [p, minRest] of prefixes) {
    for (const base of Array.from(out)) {
      if (base.startsWith(p) && base.length - p.length >= minRest) {
        out.add(base.slice(p.length));
      }
    }
  }

  const suffixes = ['كم', 'ك', 'ها', 'هم', 'هن', 'ات', 'ين', 'ه', 'ي'];
  for (const s of suffixes) {
    for (const base of Array.from(out)) {
      if (base.endsWith(s) && base.length - s.length >= 2) {
        out.add(base.slice(0, -s.length));
      }
    }
  }

  for (const b of Array.from(out)) out.add(collapseRepeats(b));
  return out;
}

/** أشكال العبارة: كما هي + بدون "ال" التعريف */
function phraseVariants(norm: string): string[] {
  const out = [norm];
  const withoutAl = norm
    .split(' ')
    .map((w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w))
    .join(' ');
  if (withoutAl !== norm) out.push(withoutAl);
  return out;
}

function matchArabicTerm(
  term: Term,
  parts: ReturnType<typeof arabicParts>
): AbuseMatch | null {
  const { tokens, compact, collapsedCompact, spaced } = parts;
  const norm = normalizeArabic(term.text);
  if (!norm) return null;
  const normCollapsed = collapseRepeats(norm);
  const isArabicTerm = /[\u0600-\u06FF]/.test(norm);

  // عبارة من كلمتين أو أكثر
  if (norm.includes(' ')) {
    const joined = tokens.join(' ');
    const minCompact = spaced ? 3 : 4;
    for (const phrase of phraseVariants(norm)) {
      if (` ${joined} `.includes(` ${phrase} `)) {
        return { term: term.text, normalized: norm, kind: 'phrase' };
      }
      if (!isArabicTerm) continue;
      const phraseCompact = collapseRepeats(phrase.replace(/\s+/g, ''));
      if (
        phraseCompact.length >= minCompact &&
        (compact.includes(phraseCompact) || collapsedCompact.includes(phraseCompact))
      ) {
        return { term: term.text, normalized: norm, kind: 'phrase' };
      }
    }
    return null;
  }

  // كلمة واحدة: نفحص كل الكلمات مع بدائل البداية/النهاية/التكرار
  for (const tok of tokens) {
    for (const v of tokenVariants(tok)) {
      if (v === norm || v === normCollapsed) {
        return { term: term.text, normalized: norm, kind: 'arabic' };
      }
      if (
        term.prefix &&
        (v.startsWith(norm) || v.startsWith(normCollapsed)) &&
        v.length <= norm.length + 6
      ) {
        return { term: term.text, normalized: norm, kind: 'arabic' };
      }
    }
  }

  // التمويه بالمسافات/الرموز: "ك س م ك" أو "ك.س.م.ك"
  // نسمح بجذور من 3 حروف فقط عند وجود تباعد حرفي واضح
  // (ولا نطبقها على الكلمات اللاتينية حتى لا يتحول retardant إلى retard)
  const minCompact = spaced ? 3 : 4;
  if (
    isArabicTerm &&
    normCollapsed.length >= minCompact &&
    (compact.includes(normCollapsed) || collapsedCompact.includes(normCollapsed))
  ) {
    return { term: term.text, normalized: norm, kind: 'arabic' };
  }

  return null;
}

/** بدائل الكلمة الإنجليزية (تكرار الحروف + حذف الحروف المتحركة لكشف f*ck) */
function englishWordVariants(norm: string): Set<string> {
  const out = new Set<string>([norm, collapseRepeats(norm)]);
  const noVowels = norm.replace(/[aeiou]/g, '');
  if (norm.length >= 4 && noVowels.length >= 2) out.add(noVowels);
  const suffixes = ['s', 'es', 'ed', 'ing', 'er', 'ers', 'y'];
  for (const s of suffixes) {
    for (const base of Array.from(out)) {
      if (base.endsWith(s) && base.length - s.length >= 4) {
        out.add(base.slice(0, -s.length));
      }
    }
  }
  for (const b of Array.from(out)) out.add(collapseRepeats(b));
  return out;
}

function matchEnglishTerm(
  term: Term,
  parts: ReturnType<typeof englishParts>
): AbuseMatch | null {
  const { tokens, compact, collapsedCompact, spaced } = parts;
  const norm = normalizeEnglish(term.text);
  if (!norm) return null;
  const normCollapsed = collapseRepeats(norm);
  const variants = englishWordVariants(norm);

  // عبارة إنجليزية
  if (norm.includes(' ')) {
    const padded = ` ${tokens.join(' ')} `;
    for (const phrase of [norm, normCollapsed]) {
      if (padded.includes(` ${phrase} `)) {
        return { term: term.text, normalized: norm, kind: 'phrase' };
      }
    }
    const phraseCompact = collapseRepeats(norm.replace(/\s+/g, ''));
    if (
      phraseCompact.length >= (spaced ? 3 : 5) &&
      (compact.includes(phraseCompact) || collapsedCompact.includes(phraseCompact))
    ) {
      return { term: term.text, normalized: norm, kind: 'phrase' };
    }
    return null;
  }

  for (const tok of tokens) {
    const tokVariants = new Set<string>([tok, collapseRepeats(tok)]);
    // لواحق شائعة على كلمة الرسالة نفسها (sluts / bitches / retarded / fucking / dumber)
    for (const s of ['s', 'es', 'ed', 'ing', 'er', 'ers', 'est', 'y']) {
      for (const base of Array.from(tokVariants)) {
        if (base.endsWith(s) && base.length - s.length >= 4) {
          tokVariants.add(base.slice(0, -s.length));
        }
      }
    }
    for (const v of tokVariants) {
      if (variants.has(v)) {
        return { term: term.text, normalized: norm, kind: 'english' };
      }
      if (
        term.prefix &&
        (v.startsWith(norm) || v.startsWith(normCollapsed)) &&
        v.length <= norm.length + 6
      ) {
        return { term: term.text, normalized: norm, kind: 'english' };
      }
    }
  }

  // حروف متباعدة أو رموز داخل الكلمة: f u c k / f*ck / b*tch
  if (spaced || tokens.length <= 2) {
    const compactVariants = new Set<string>([compact, collapsedCompact]);
    for (const s of ['s', 'es', 'ed', 'ing', 'er', 'ers', 'y']) {
      if (compact.endsWith(s) && compact.length - s.length >= 3) {
        compactVariants.add(compact.slice(0, -s.length));
      }
      if (collapsedCompact.endsWith(s) && collapsedCompact.length - s.length >= 3) {
        compactVariants.add(collapsedCompact.slice(0, -s.length));
      }
    }
    for (const v of variants) {
      if (v.length < 3) continue;
      if (compactVariants.has(v)) {
        return { term: term.text, normalized: norm, kind: 'english' };
      }
    }
  }

  return null;
}

// --------------------------------------------
// الواجهة العامة
// --------------------------------------------

/**
 * يكشف الإساءة في نص واحد.
 * @param extraWords كلمات محظورة إضافية من إعدادات السيرفر
 */
export function findAbuse(rawText: string, extraWords: string[] = []): AbuseMatch | null {
  const text = String(rawText || '');
  if (!text || text.length > 4000) return null;

  // إزالة العبارات الآمنة (كلب الحراسة / حمار وحشي) قبل الفحص العربي
  const arabicNorm = normalizeArabic(text);
  const arabicClean = stripBenignCompounds(arabicNorm);

  const ar = arabicParts(arabicClean);
  const en = englishParts(text);

  // كلمات السيرفر المخصّصة أولاً (أولوية للسبب المعلن)
  for (const raw of extraWords) {
    const term = String(raw || '').trim();
    if (!term) continue;
    const match = matchArabicTerm({ text: term }, ar) || matchEnglishTerm({ text: term }, en);
    if (match) return match;
  }

  // Arabizi المكتوب بأرقام (3ars / 7mar ...)
  const arabizi = matchLooseTerm(text, ARABIZI_TERMS);
  if (arabizi) {
    return { term: arabizi, normalized: looseNormalize(arabizi), kind: 'arabic' };
  }

  for (const term of SORTED_ARABIC_TERMS) {
    const match = matchArabicTerm(term, ar);
    if (match) return match;
  }

  if (en.tokens.length) {
    for (const term of SORTED_ENGLISH_TERMS) {
      const match = matchEnglishTerm(term, en);
      if (match) return match;
    }
  }

  return null;
}

/** هل النص يحتوي على سب صريح (يُعدّ استهدافاً للبوت حتى بدون منشن)؟ */
export function containsHardSlur(rawText: string, extraWords: string[] = []): boolean {
  const text = String(rawText || '');
  if (!text) return false;

  // Arabizi الصريح (3ars / 7mar / ksmk ...)
  if (matchLooseTerm(text, ARABIZI_HARD_SLURS)) return true;

  const ar = arabicParts(stripBenignCompounds(normalizeArabic(text)));
  for (const raw of STANDALONE_SLURS) {
    // الكلمات اللاتينية تُفحص في المسار الإنجليزي فقط
    if (/^[a-z0-9\s']+$/i.test(raw)) continue;
    // بدون prefix: نتجنب نيكوتين / خوليو
    const match = matchArabicTerm({ text: raw }, ar);
    if (match) return true;
  }

  const en = englishParts(text);
  if (en.tokens.length) {
    for (const raw of STANDALONE_SLURS) {
      if (!/^[a-z0-9\s']+$/i.test(raw)) continue;
      // بدون prefix: نتجنب niggardly / retardant
      const match = matchEnglishTerm({ text: raw }, en);
      if (match) return true;
    }
  }

  for (const raw of extraWords) {
    if (!String(raw || '').trim()) continue;
    const match = matchArabicTerm({ text: raw, prefix: true }, ar);
    if (match) return true;
  }
  return false;
}

/** مخرجات تشخيصية لاختبار الكشف */
export interface AbuseDiagnostics {
  normalizedArabic: string;
  normalizedEnglish: string;
  match: AbuseMatch | null;
  hardSlur: boolean;
}

export function diagnoseAbuse(rawText: string, extraWords: string[] = []): AbuseDiagnostics {
  return {
    normalizedArabic: normalizeArabic(rawText),
    normalizedEnglish: normalizeEnglish(rawText),
    match: findAbuse(rawText, extraWords),
    hardSlur: containsHardSlur(rawText, extraWords),
  };
}
