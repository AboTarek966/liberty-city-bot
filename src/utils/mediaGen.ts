// ============================================
// Liberty City Bot - توليد الموسيقى والفيديو
//
// مجاني بالكامل عبر Hugging Face Spaces (ZeroGPU)
//   ⚠️ يتطلب حساب Hugging Face مجاني (بلا بطاقة ائتمان) — HF_TOKEN
//
// ملاحظات تشغيلية مقاسة:
//   - أغنية كاملة (ACE-Step): ~12-30 ثانية
//   - موسيقى عزفية (Stable Audio): ~30-90 ثانية + انتظار طابور أحياناً
//   - الفيديو: ~3-15 دقيقة
//   لذلك يُرسَّل رد انتظار فوراً وتُعدَّل الرسالة عند اكتمال التوليد.
// ============================================

import axios from 'axios';
import { config } from '../config';
import { translateForImage } from './imageGen';
import { callSpaceFn, downloadResult, wakeSpace, spaceHost } from './hfSpaces';
import { createLogger } from './helpers';

const logger = createLogger('MediaGen');

export interface GeneratedMedia {
  data: Buffer;
  ext: string;
  mimeType: string;
  /** النص الخام للنموذج (اختياري — بعض المساحات ترجع وصفاً) */
  note?: string;
}

/** هل توليد الوسائط متاح؟ (يحتاج HF_TOKEN) */
export function mediaGenAvailable(): { music: boolean; video: boolean; reason?: string } {
  if (!config.ai.hf.token) return { music: false, video: false, reason: 'HF_TOKEN غير مضبوط' };
  return { music: true, video: true };
}

// --------------------------------------------
// كشف طلبات الموسيقى
// --------------------------------------------
const MUSIC_TRIGGERS: RegExp[] = [
  // اعزفلي / اعزف / انشغل / سوي لحن / اعمل اغنية
  /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز)?\s*(?:اعزفلي|اعزف\s*لي|اعزف|انشغل\s*لي|انشغل|شغل\s*لي|شغل|اسمعلي|اسمع\s*لي|غني\s*لي|غني|سوي\s*لي|سوي|سوّي\s*لي|سوّي|اعمل\s*لي|اعمل|اكتب\s*لي|اكتب|ارسملي|ارسم\s*لي|ارسم|صمملي|صمم\s*لي|صمم|طلّع\s*لي|طلّع|طلع\s*لي|طلع|انشئ\s*لي|انشئ)\s*(?:أغني[هة]|اغني[هة]|لحن|موسيق[اة]|موسيقه|مزيكا|نغم[هة]|نغمه|كوبليه|انسترومنتال|انشوده|أنشوده|مقطوعه|مقطوعة|صوت|مقطع)\s*(?:[:\-–،,]\s*|لـ|عن\s*)?(.{0,200})$/is,
  // "اغنية ..." / "لحن ..." كطلب مباشر
  /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز)?\s*(?:ابغى|أبغى|ابي|أبي|بدي|ودي|ابغى\s*لي|ابي\s*لي)?\s*(?:لي\s*)?(?:أغني[هة]|اغني[هة]|لحن|موسيق[اة]|موسيقه|مزيكا|نغم[هة]|نغمه|انشوده|أنشوده)\s*(?:جديده|جديدة|جديد)?\s*(?:[:\-–،,]\s*|لـ|لف|عن\s*)?(.{3,})$/is,
  // إنجليزي: play/make/create a song, music, melody
  /^\s*(?:please\s+)?(?:play|make|create|generate|compose|sing|write|perform|give\s+me)\s+(?:me\s+)?(?:an?\s+)?(?:song|music|melody|tune|track|beat|instrumental|jingle|anthem|rap|jazz|piano|guitar|orchestra)\b\s*(?:of|about|for|called|:|with|-)?\s*(.{0,200})$/is,
  /^\s*(?:song|music|melody|tune|beat)\s*(?:about|of|:|with)\s*(.{3,})$/is,
];

export function detectMusicPrompt(text: string): string | null {
  const raw = (text || '').trim();
  if (raw.length < 4) return null;
  for (const re of MUSIC_TRIGGERS) {
    const m = raw.match(re);
    if (!m) continue;
    const prompt = (m[1] || '').replace(/["“”'‘’]/g, '').replace(/\s+/g, ' ').trim();
    // الوصف اختياري — "اعزف مزيكا" يبقى طلباً صحيحاً رغم خلوّه من الوصف
    return prompt.length >= 3 ? prompt.slice(0, 400) : 'a pleasant instrumental melody, calm and uplifting';
  }
  return null;
}

// --------------------------------------------
// كشف طلبات الفيديو
// --------------------------------------------
const VIDEO_TRIGGERS: RegExp[] = [
  // اعمل/سوي/طلّع + فيديو/مقطع
  /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز)?\s*(?:اعمل|عمل|سوي|سوّي|طلّع|طلع|انشئ|انشائي)\s*(?:لي\s*)?(?:فيديو|مقطع|فيلم|فيدو|video|clip)\s*(?:[:\-–،,]\s*|لـ|لف|عن\s*)?(.{3,})$/is,
  // "فيديو ..." كطلب مباشر
  /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز)?\s*(?:فيديو|مقطع|فيلم)\s*(?:جديد|قصير)?\s*(?:[:\-–،,]\s*|لـ|لف|عن\s*)?(.{3,})$/is,
  // إنجليزي: make/create/generate a video
  /^\s*(?:please\s+)?(?:make|create|generate|produce|render|animate)\s+(?:me\s+)?(?:an?\s+)?(?:video|clip|film|animation|movie)\s*(?:of|about|for|:|with)?\s*(.{3,})$/is,
  /^\s*(?:video|clip|film)\s*(?:of|about|:|with)\s+(.{3,})$/is,
];

export function detectVideoPrompt(text: string): string | null {
  const raw = (text || '').trim();
  if (raw.length < 4) return null;
  for (const re of VIDEO_TRIGGERS) {
    const m = raw.match(re);
    if (!m) continue;
    const prompt = (m[1] || '').replace(/["“”'‘’]/g, '').replace(/\s+/g, ' ').trim();
    if (prompt.length >= 3) return prompt.slice(0, 400);
  }
  return null;
}

// --------------------------------------------
// التوليد الفعلي
// --------------------------------------------

/** يولّد موسيقى عبر مساحة Hugging Face (Stable Audio 3) */
export async function generateMusic(
  prompt: string,
  opts: { seconds?: number; variant?: 'medium' | 'small-music' | 'small-sfx' } = {}
): Promise<GeneratedMedia | null> {
  const { musicSpace, musicFnIndex, musicTimeoutMs } = config.ai.hf;
  try {
    await wakeSpace(musicSpace);

    // واجهة /infer في Stable Audio 3 — 7 معاملات بالترتيب:
    //   [variant_key, prompt, duration, steps, cfg_scale, sampler_type, seed]
    const variant = opts.variant ?? 'small-music'; // أسرع نموذج موسيقي (0.6B)
    const duration = Math.min(Math.max(Math.round(opts.seconds ?? 15), 1), 60);
    const full = `${prompt}. Instrumental, clear melody, high quality.`;

    const data = [variant, full, duration, 12, 2.5, 'dpmpp', Math.floor(Math.random() * 1_000_000)];
    const result = await callSpaceFn(musicSpace, musicFnIndex, data, { timeoutMs: musicTimeoutMs });

    const url = pickAudioUrl(result.files);
    if (!url) {
      logger.warn(`Music result had no audio file: ${JSON.stringify(result.raw).slice(0, 300)}`);
      return null;
    }

    const dataBuf = await downloadResult(url, { maxBytes: 60 * 1024 * 1024, timeoutMs: 120_000 });
    const ext = guessExt(url, 'wav');
    logger.info(`Music generated: ${(dataBuf.length / 1024).toFixed(0)}KB .${ext}`);
    return { data: dataBuf, ext, mimeType: ext === 'wav' ? 'audio/wav' : `audio/${ext}` };
  } catch (err: any) {
    logger.error('generateMusic failed:', err?.message || err);
    return null;
  }
}

// ============================================
// 🎤 أغنية كاملة: كلمات + غناء + لحن
//    عبر ACE-Step (Hugging Face / ZeroGPU) — مجاني
//
// مُختبَرة يدوياً 4 أكتوبر... بالأحرى 14 أكتوبر 2026:
//   - 45 ثانية MP3 في ~12 ثانية
//   - Whisper يعيد "language: Arabic" + ينسخ الكلمات التي أدخلناها
//   - 3 أغانٍ متتالية دون استنزاف الحصة
//
// خطوة 1: نكتب الكلمات باللهجة المطلوبة (Groq / allam-2-7b — عربي أصلي)
// خطوة 2: نترجم الوصف إلى وسوم أسلوب إنجليزية (ACE-Step لا يفهم العربية)
// خطوة 3: نستدعي ACE-Step ونعيد ملف MP3 المغنّى
// ============================================

export const DEFAULT_INSTRUMENTAL_PROMPT = 'a pleasant instrumental melody, calm and uplifting';
const ARABIC_RE = /[\u0600-\u06FF]/;

export type Dialect = 'egyptian' | 'gulf' | 'levant' | 'iraqi' | 'msa' | 'english';

interface DialectInfo {
  /** اسم اللهجة كما يُعرض للمستخدم */
  label: string;
  /** وسوم الأسلوب الموسيقي بالإنجليزية (ACE-Step prompt) */
  tags: string;
  /** تعليمات كتابة الكلمات بلهجة */
  brief: string;
}

const DIALECTS: Record<Dialect, DialectInfo> = {
  egyptian: {
    label: 'مصرية',
    tags: 'egyptian pop, oud, darbuka, hand percussion, warm male vocals, catchy melody, arab pop',
    brief: 'باللهجة المصرية العامية (أمثلة: يا قلبي، انت، مفيش، خلينا)',
  },
  gulf: {
    label: 'خليجية',
    tags: 'khaleeji gulf pop, oud, rebab, arabic percussion, smooth male vocals, romantic, melodic',
    brief: 'باللهجة الخليجية العامية (أمثلة: يا بعد عمري، وش تبي، وايد، حبيبي)',
  },
  levant: {
    label: 'شامية',
    tags: 'levantine syrian pop, oud, qanun, arabic strings, emotional vocals, warm, melodic',
    brief: 'باللهجة الشامية (أمثلة: شو عم بيصير، كتير، حلوة، الله يستر)',
  },
  iraqi: {
    label: 'عراقية',
    tags: 'iraqi maqam pop, mijwiz, tabla, oud, rhythmic, warm male vocals, traditional yet modern',
    brief: 'باللهجة العراقية (أمثلة: هواية، شلونك، يمي، حجي)',
  },
  msa: {
    label: 'فصحى',
    tags: 'modern arabic pop, orchestral strings, piano, oud, anthemic, clean production',
    brief: 'بالعربية الفصحى المعاصرة',
  },
  english: {
    label: 'إنجليزية',
    tags: 'pop, piano, acoustic guitar, strings, smooth vocals, radio hit, polished production',
    brief: 'in English',
  },
};

const DIALECT_PATTERNS: [RegExp, Dialect][] = [
  [/(إنجليزي|انجليزي|إنجليزية|انجليزية|english)/i, 'english'],
  [/(مصري|مصرية|عامية\s*مصرية|إسكندر|اسكندر|القاهري|قاهره)/i, 'egyptian'],
  [/(خليجي|خليجية|خليج|سعود|السعودية|إمارات|امارات|دبي|أبوظبي|ابوظبي|كويت|قطري|قطر|بحريني|عماني|حجازي)/i, 'gulf'],
  [/(شامي|شامية|سوري|سورية|لبنان|لبناني|فلسطين|فلسطيني|أردن|اردن|دمشق|بيروت)/i, 'levant'],
  [/(عراقي|عراقية|بغداد|العراق)/i, 'iraqi'],
  [/(فصحى|الفصحى|فصحية|عربية\s*فصحى|msa)/i, 'msa'],
];

/** يكتشف اللهجة المطلوبة من نص المستخدم — الافتراضي مصرية (الأكثر انتشاراً في الأغنية العربية) */
export function detectDialect(text: string): Dialect {
  const q = (text || '').trim();
  if (!q) return 'egyptian';
  for (const [re, d] of DIALECT_PATTERNS) if (re.test(q)) return d;
  return ARABIC_RE.test(q) ? 'egyptian' : 'english';
}

// كلمات تشغيل "لحن/موسيقى فقط" مقابل "أغنية بكلمات"
const INSTRUMENTAL_ONLY =
  /(instrumental|no\s+vocals|without\s+vocals|\bbgm\b|بدون\s*(كلمات|غناء|صوت\s*بشري|اغني)|بلا\s*كلمات|من\s*دون\s*كلمات|لحن\s*(فقط|بس)|موسيق[اة]\s*(فقط|بس)|مقطوعة\s*(فقط|بس))/i;
const NOUN_INSTRUMENTAL = /(لحن|موسيق|مزيكا|مقطوع|نغم|melody|tune|track|beat|music)/i;
const NOUN_VOCAL = /(أغني|اغني|غن|أنشودة|انشودة|كوبليه|كلمات|song|sing|vocal|lyric)/i;

/**
 * هل الطلب موسيقى عزفية (بدون غناء) أم أغنية كاملة بكلمات؟
 * القاعدة: "لحن/موسيقى/مقطوعة" منفردة = عزف — أما "أغنية/كلمات/غني" = أغنية كاملة.
 * المستخدم طلب أن يبني البوت أغنية كاملة افتراضياً.
 */
export function isInstrumentalOnly(question: string): boolean {
  const q = (question || '').trim();
  if (!q) return false;
  if (INSTRUMENTAL_ONLY.test(q)) return true;
  return NOUN_INSTRUMENTAL.test(q) && !NOUN_VOCAL.test(q);
}

// --------------------------------------------
// وسوم الأسلوب: نترجم الوصف العربي إلى إنجليزي
// --------------------------------------------
const TAG_SYSTEM =
  'You convert a song description into English music-style tags for a song generator. ' +
  'Reply with ONLY comma-separated tags (mood, genre, instruments, voice type), max 15 tags. ' +
  'No sentences, no quotes, no explanation.';

/** يترجم وصف المستخدم إلى وسوم أسلوب إنجليزية (أو يعيده كما هو إن كان إنجليزياً) */
async function toStyleTags(text: string): Promise<string> {
  return translateForImage((text || '').trim(), TAG_SYSTEM);
}

// --------------------------------------------
// كتابة الكلمات — Groq (مجاني، < 1 ثانية)
// --------------------------------------------
const LYRIC_MODELS = ['allam-2-7b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];

function lyricsSystem(dialect: Dialect): string {
  const info = DIALECTS[dialect];
  if (dialect === 'english') {
    return (
      'You are a professional songwriter. Write short song lyrics in English. ' +
      'Structure EXACTLY: a line "[verse]", then 4 lines, a blank line, a line "[chorus]", then 4 lines. ' +
      'Each lyric line 5-9 words, positive and singable. ' +
      'Output ONLY the lyrics — no titles, no quotes, no explanation, no text after the lyrics.'
    );
  }
  return (
    `أنت شاعر غنائي محترف. اكتب كلمات أغنية قصيرة ${info.brief}. ` +
    'البناء بالضبط: سطر "[verse]" ثم 4 أسطر، ثم سطر فارغ، ثم سطر "[chorus]" ثم 4 أسطر. ' +
    'كل سطر من 5 إلى 9 كلمات حتى يصلح للغناء، ومشاعر إيجابية ومحببة، بلا أي ألفاظ نابية. ' +
    'أخرج النص فقط: لا مقدمة ولا عنوان ولا شرح ولا علامات اقتباس ولا أي شيء بعد الكلمات.'
  );
}

/**
 * يولّد كلمات الأغنية باللهجة المطلوبة.
 * يعيد النص المجهّز بوسوم [verse]/[chorus] أو null عند فشل كل الموديلات.
 * زمن مقاس: ~400-1200ms.
 */
export async function generateLyrics(topic: string, dialect: Dialect): Promise<string | null> {
  const apiKey = config.ai.groq.apiKey;
  if (!apiKey) {
    logger.warn('Groq key missing — cannot write lyrics');
    return null;
  }

  const subject = (topic || '').trim();
  const userMsg = subject
    ? `موضوع الأغنية: ${subject}`
    : 'اكتب كلمات عامة عن الحب والسعادة والحياة الحلوة.';

  for (const model of LYRIC_MODELS) {
    try {
      const res = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: lyricsSystem(dialect) },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.9,
          max_tokens: 700,
        },
        { timeout: 15_000, headers: { Authorization: `Bearer ${apiKey}` } }
      );

      const out: string | undefined = res.data?.choices?.[0]?.message?.content;
      const clean = normalizeLyrics(out, dialect);
      if (clean) {
        logger.info(`Lyrics written [${model}, ${dialect}]: ${clean.split('\n').length} lines`);
        return clean;
      }
      logger.warn(`Lyrics model ${model} returned unusable output — trying next`);
    } catch (err: any) {
      logger.warn(`Lyrics model ${model} failed: ${err?.message || err}`);
    }
  }
  return null;
}

/** ينظّف ناتج النموذج ويتأكد من وجود بنية الأغنية */
function normalizeLyrics(raw: string | undefined, dialect: Dialect): string | null {
  if (!raw) return null;
  let s = raw
    .trim()
    .replace(/^```(?:\w+)?\s*|\s*```$/g, '')
    .trim();
  // نزيل أي مقدمة شرحية مثل: "كلمات الأغنية:" أو "Sure! Here are the lyrics:"
  s = s
    .replace(
      /^(?:كلمات(?:\s+الأغنية)?\s*[:：-]|here (?:are|is) (?:the )?(?:song )?lyrics(?: for you)?\s*[:.-]?)\s*/i,
      ''
    )
    .trim();
  s = s.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (s.length < 40 || s.length > 1600) return null;

  // اللهجة العربية يجب أن تكون عربية فعلاً
  if (dialect !== 'english' && !ARABIC_RE.test(s)) return null;
  if (dialect === 'english' && ARABIC_RE.test(s)) return null;

  return compactLyrics(s);
}

/** وسوم الأقسام التي يفهمها ACE-Step */
const ACE_BLOCK_TAG = new Set(['verse', 'chorus', 'bridge', 'outro', 'instrumental']);
const BLOCK_ALIAS: Record<string, string> = { hook: 'chorus', intro: 'verse', refrain: 'chorus' };
/** حدود الأسطر لكل قسم — 60 ثانية تكفي ~14 سطراً بواقع ~3.5 ثانية للسطر */
const BLOCK_MAX_LINES: Record<string, number> = { verse: 4, chorus: 6, bridge: 4, outro: 4, instrumental: 0 };

/**
 * يفكّك الكلمات إلى مقاطع ويقصّها لتناسب مدة الأغنية.
 * يضمن وجود كورس دائماً (بعض الموديلات تنساه) ويمنع تكرار المقاطع الطويل.
 */
function compactLyrics(s: string): string {
  type Block = { tag: string; lines: string[] };
  const blocks: Block[] = [];
  let cur: Block | null = null;

  for (const raw of s.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\[([a-z]+)\]\s*(.*)$/i);
    if (m) {
      const tag = BLOCK_ALIAS[m[1].toLowerCase()] || m[1].toLowerCase();
      if (ACE_BLOCK_TAG.has(tag)) {
        cur = { tag, lines: [] };
        blocks.push(cur);
        if (m[2].trim()) cur.lines.push(m[2].trim());
        continue;
      }
    }
    if (!cur) {
      cur = { tag: 'verse', lines: [] };
      blocks.push(cur);
    }
    cur.lines.push(line);
  }

  let kept = blocks.filter((b) => b.lines.length > 0).slice(0, 3);
  if (!kept.length) return '';

  kept = kept
    .map((b) => ({ tag: b.tag, lines: b.lines.slice(0, BLOCK_MAX_LINES[b.tag] ?? 4) }))
    .filter((b) => b.lines.length > 0);

  // لا كورس؟ نصنع واحداً من نصف الكلمات (الموديل ينساه أحياناً)
  if (!kept.some((b) => b.tag === 'chorus')) {
    const all = kept.flatMap((b) => b.lines);
    const mid = Math.max(1, Math.min(4, Math.floor(all.length / 2)));
    const chorus = all.slice(mid, mid + 6);
    if (chorus.length === 0) return '';
    return `[verse]\n${all.slice(0, mid).join('\n')}\n\n[chorus]\n${chorus.join('\n')}`;
  }

  return kept.map((b) => `[${b.tag}]\n${b.lines.join('\n')}`).join('\n\n');
}

// --------------------------------------------
// ACE-Step — مخطط المعاملات (22 معاملة)
// --------------------------------------------
const ACE_INFO_URL = 'ACE-Step/ACE-Step';
let aceParamsCache: { at: number; params: any[] } | null = null;

/** مخطط احتياطي إن تعذّر جلب /gradio_api/info (نفس ترتيب المساحة المُختبَر) */
const ACE_PARAMS_FALLBACK: any[] = [
  { parameter_name: 'audio_duration', parameter_has_default: true, parameter_default: 60 },
  { parameter_name: 'prompt', parameter_has_default: true, parameter_default: 'pop, male vocals' },
  { parameter_name: 'lyrics', parameter_has_default: true, parameter_default: '[verse]\nHello' },
  { parameter_name: 'infer_step', parameter_has_default: true, parameter_default: 60 },
  { parameter_name: 'guidance_scale', parameter_has_default: true, parameter_default: 15 },
  { parameter_name: 'scheduler_type', parameter_has_default: true, parameter_default: 'euler' },
  { parameter_name: 'cfg_type', parameter_has_default: true, parameter_default: 'apg' },
  { parameter_name: 'omega_scale', parameter_has_default: true, parameter_default: 10 },
  { parameter_name: 'manual_seeds', parameter_has_default: true, parameter_default: null },
  { parameter_name: 'guidance_interval', parameter_has_default: true, parameter_default: 0.5 },
  { parameter_name: 'guidance_interval_decay', parameter_has_default: true, parameter_default: 0 },
  { parameter_name: 'min_guidance_scale', parameter_has_default: true, parameter_default: 3 },
  { parameter_name: 'use_erg_tag', parameter_has_default: true, parameter_default: true },
  { parameter_name: 'use_erg_lyric', parameter_has_default: true, parameter_default: false },
  { parameter_name: 'use_erg_diffusion', parameter_has_default: true, parameter_default: true },
  { parameter_name: 'oss_steps', parameter_has_default: true, parameter_default: null },
  { parameter_name: 'guidance_scale_text', parameter_has_default: true, parameter_default: 0 },
  { parameter_name: 'guidance_scale_lyric', parameter_has_default: true, parameter_default: 0 },
  { parameter_name: 'audio2audio_enable', parameter_has_default: true, parameter_default: false },
  { parameter_name: 'ref_audio_strength', parameter_has_default: true, parameter_default: 0.5 },
  { parameter_name: 'ref_audio_input', parameter_has_default: true, parameter_default: null },
  { parameter_name: 'lora_name_or_path', parameter_has_default: true, parameter_default: 'none' },
];

/** يجلب مخطط معاملات ACE-Step (يُخزَّن ساعة) — يسمح لنا بالتكيف إن تغيّرت المساحة */
async function getAceParams(): Promise<any[]> {
  if (aceParamsCache && Date.now() - aceParamsCache.at < 3_600_000) return aceParamsCache.params;
  try {
    const { data } = await axios.get(`https://${spaceHost(ACE_INFO_URL)}.hf.space/gradio_api/info`, {
      timeout: 25_000,
      headers: { 'User-Agent': 'LibertyCityBot' },
    });
    const params = data?.named_endpoints?.['/__call__']?.parameters;
    if (Array.isArray(params) && params.length >= 3) {
      aceParamsCache = { at: Date.now(), params };
      logger.info(`ACE-Step schema loaded: ${params.length} params`);
      return params;
    }
    throw new Error('schema missing');
  } catch (err: any) {
    logger.warn(`ACE-Step schema fetch failed — using fallback: ${err?.message || err}`);
    return ACE_PARAMS_FALLBACK;
  }
}

function buildAceData(params: any[], overrides: Record<string, unknown>): unknown[] {
  return params.map((p) =>
    Object.prototype.hasOwnProperty.call(overrides, p.parameter_name)
      ? overrides[p.parameter_name]
      : p.parameter_default
  );
}

// --------------------------------------------
// الحجز العالمي: أغنية واحدة كل فترة حتى لا نستنزف حصة ZeroGPU
// --------------------------------------------
let lastSongAt = 0;

export interface SongResult extends GeneratedMedia {
  lyrics: string;
  dialectLabel: string;
}

/**
 * نتيجة توليد الأغنية — قد تنجح بالوسائط أو تفشل مع بقاء الكلمات.
 *
 * ⚠️ حدود خارجية مقاسة (Hugging Face ZeroGPU — مجاني بلا بطاقة):
 *   الحساب المجاني = 5 دقائق GPU يومياً + حد تشغيلات يومي، ويُحتسب كل تشغيل
 *   ACE-Step بستين ثانية على الأقل. عملياً ≈ 5 أغانٍ كل 24 ساعة.
 *   لذلك نُعيد الكلمات المكتوبة دائماً حتى لو تعذّر الغناء — فهي مجانية بلا حدود.
 */
export type SongOutcome =
  | { ok: true; media: SongResult }
  | { ok: false; reason: SongFailReason; lyrics: string | null; dialectLabel: string };

export type SongFailReason = 'quota' | 'unavailable' | 'no-lyrics';

/** صياغة عربية صادقة لسبب تعذّر الغناء (تُعرض للمستخدم مباشرة) */
export function songFailText(reason: SongFailReason): string {
  if (reason === 'quota') return 'انتهت الحصة المجانية اليومية للغناء (≈5 أغانٍ كل 24 ساعة)';
  if (reason === 'no-lyrics') return 'تعذّرت كتابة كلمات الأغنية الآن';
  return 'طابور المعالجات المجاني مشغول الآن';
}

/** يميّز نفاد الحصة عن باقي الأخطاء (الرسالة تُعرض للمستخدم بصياغة صادقة) */
function isQuotaError(msg: string): boolean {
  return /quota|exceeded your free|No GPU was available|insufficient/i.test(msg);
}

/**
 * يولّد أغنية كاملة: كلمات باللهجة المطلوبة + غناء + لحن.
 * تُكتب الكلمات أولاً لأنها الأرخص ولا تنفد أبداً — وتبقى صالحة للعرض عند فشل المعالج.
 */
export async function generateSong(
  opts: { topic: string; question: string; seconds?: number; dialect?: Dialect }
): Promise<SongOutcome> {
  const { songSpace, songFnIndex, songTimeoutMs, songMinIntervalMs } = config.ai.hf;
  const dialect = opts.dialect ?? detectDialect(`${opts.question} ${opts.topic}`);
  const info = DIALECTS[dialect];

  const fail = (reason: SongFailReason, lyrics: string | null): SongOutcome => ({
    ok: false,
    reason,
    lyrics,
    dialectLabel: info.label,
  });

  // 1) الحجز العالمي (الرسالة المؤقتة أُرسلت أصلاً، الانتظار مقبول)
  try {
    const wait = lastSongAt + songMinIntervalMs - Date.now();
    if (wait > 0) {
      logger.info(`Song rate-limited — waiting ${(wait / 1000).toFixed(1)}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
    lastSongAt = Date.now();
  } catch {
    /* لا شيء */
  }

  // 2) الكلمات أولاً (أرخص خطوة ولا تنفد) — إن فشلت لا نستهلك GPU بلا فائدة
  const lyrics = await generateLyrics(opts.topic, dialect);
  if (!lyrics) {
    logger.warn('Lyrics generation failed — skipping GPU call');
    return fail('no-lyrics', null);
  }

  try {
    // 3) وسوم الأسلوب + وصف المستخدم
    const translated = await toStyleTags(opts.topic);
    const tags = [info.tags, translated]
      .filter(Boolean)
      .join(', ')
      .replace(/\s+/g, ' ')
      .slice(0, 400);

    // 4) استدعاء ACE-Step
    await wakeSpace(songSpace);
    const params = await getAceParams();
    const data = buildAceData(params, {
      audio_duration: Math.min(Math.max(Math.round(opts.seconds ?? 60), 15), 120),
      prompt: tags,
      lyrics,
      infer_step: 27, // مقاس: أسرع بـ2.2x من 60 خطوة بجودة مقبولة
      manual_seeds: String(Math.floor(Math.random() * 1_000_000)),
    });

    logger.info(
      `Song start [${info.label}] "${(opts.topic || 'بدون موضوع').slice(0, 60)}" tags="${tags.slice(0, 70)}"`
    );
    const result = await callSpaceFn(songSpace, songFnIndex, data, { timeoutMs: songTimeoutMs });

    const url = pickAudioUrl(result.files);
    if (!url) {
      logger.warn(`Song result had no audio file: ${JSON.stringify(result.raw).slice(0, 300)}`);
      return fail('unavailable', lyrics);
    }

    // Discord: حد المرفقات الصوتية 8MB — نلتزم بـ7MB
    const buf = await downloadResult(url, { maxBytes: 7 * 1024 * 1024, timeoutMs: 120_000 });
    const ext = guessExt(url, 'mp3');
    logger.info(`Song generated: ${(buf.length / 1024).toFixed(0)}KB .${ext} [${info.label}]`);
    return {
      ok: true,
      media: { data: buf, ext, mimeType: `audio/${ext}`, lyrics, dialectLabel: info.label },
    };
  } catch (err: any) {
    const msg = String(err?.message || err);
    logger.error('generateSong failed:', msg.slice(0, 300));
    lastSongAt = 0; // الفشل لا يُحتسب كطلب
    return fail(isQuotaError(msg) ? 'quota' : 'unavailable', lyrics);
  }
}

/** يولّد فيديو قصير عبر مساحة Hugging Face — ⚠️ تجريبي (مساحات مجانية بطيئة) */
export async function generateVideo(
  prompt: string,
  opts: { durationSeconds?: number; steps?: number } = {}
): Promise<GeneratedMedia | null> {
  const { videoSpace, videoFnIndex, videoTimeoutMs } = config.ai.hf;
  try {
    await wakeSpace(videoSpace);

    // واجهة /generate_video في Wan2.2 — 9 معاملات:
    //   [input_image, prompt, steps, negative_prompt, duration_seconds,
    //    guidance_scale, guidance_scale_2, seed, randomize_seed]
    const NEG = '色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 水印, logo, 文字, 低质量, 模糊';
    const data = [
      null,
      `${prompt}, cinematic, smooth motion, high quality`,
      opts.steps ?? 20,
      NEG,
      Math.min(Math.max(opts.durationSeconds ?? 4, 1), 10),
      1,
      1,
      Math.floor(Math.random() * 1_000_000),
      false,
    ];

    const result = await callSpaceFn(videoSpace, videoFnIndex, data, { timeoutMs: videoTimeoutMs });

    const url = pickVideoUrl(result.files);
    if (!url) {
      logger.warn(`Video result had no video file: ${JSON.stringify(result.raw).slice(0, 300)}`);
      return null;
    }

    const dataBuf = await downloadResult(url, { maxBytes: 200 * 1024 * 1024, timeoutMs: 300_000 });
    const ext = guessExt(url, 'mp4');
    logger.info(`Video generated: ${(dataBuf.length / 1024 / 1024).toFixed(1)}MB .${ext}`);
    return { data: dataBuf, ext, mimeType: `video/${ext}` };
  } catch (err: any) {
    logger.error('generateVideo failed:', err?.message || err);
    return null;
  }
}

// --------------------------------------------
// مساعدات
// --------------------------------------------
function pickAudioUrl(files: string[]): string | null {
  return (
    files.find((f) => /\.(wav|mp3|flac|ogg|m4a)(\?|$)/i.test(f)) ||
    files.find((f) => /audio|music|\.wav|\.mp3/i.test(f)) ||
    files[0] ||
    null
  );
}

function pickVideoUrl(files: string[]): string | null {
  return (
    files.find((f) => /\.(mp4|webm|mov)(\?|$)/i.test(f)) ||
    files.find((f) => /video|\.mp4|\.webm/i.test(f)) ||
    files[0] ||
    null
  );
}

function guessExt(url: string, fallback: string): string {
  const m = url.match(/\.([a-z0-9]{2,4})(\?|$)/i);
  return m ? m[1].toLowerCase() : fallback;
}

/** يلخّص انتظار التوليد لرسالة المستخدم */
export function estimateText(kind: 'song' | 'music' | 'video'): string {
  if (kind === 'song') return '🎤 بكتب الكلمات وببني الأغنية… (~1 دقيقة)';
  return kind === 'music'
    ? '🎵 بعزّف لك اللحن… (~30-90 ثانية)'
    : '🎬 بجهّز لك الفيديو… (~3-15 دقيقة، راح أعدّل الرسالة لما يخلص)';
}
