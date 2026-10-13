// ============================================
// Liberty City Bot - توليد الموسيقى والفيديو
//
// مجاني بالكامل عبر Hugging Face Spaces (ZeroGPU)
//   ⚠️ يتطلب حساب Hugging Face مجاني (بلا بطاقة ائتمان) — HF_TOKEN
//
// ملاحظات تشغيلية مقاسة:
//   - الموسيقى: ~30-90 ثانية + انتظار طابور أحياناً
//   - الفيديو: ~3-15 دقيقة
//   لذلك يُرسَّل رد انتظار فوراً وتُعدَّل الرسالة عند اكتمال التوليد.
// ============================================

import { config } from '../config';
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
  /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز)?\s*(?:اعزفلي|اعزف\s*لي|اعزف|انشغل\s*لي|انشغل|شغل\s*لي|شغل|اسمعلي|اسمع\s*لي|سوي\s*لي|سوي|اعمل\s*لي|اعمل|اكتب\s*لي)\s*(?:اغنيه|أغنية|لحن|موسيقى|موسيقه|صوت|مقطع|مزيكا|انسترومنتال|لحن موسيقي)\s*(?:[:\-–،,]\s*|لـ|عن\s*)?(.{3,})$/is,
  // "اغنية ..." / "لحن ..." كطلب مباشر
  /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز)?\s*(?:اغنيه|أغنية|لحن|موسيقى|موسيقه|مزيكا)\s*(?:جديده|جديد)?\s*(?:[:\-–،,]\s*|لـ|لف|عن\s*)?(.{3,})$/is,
  // إنجليزي: play/make/create a song, music, melody
  /^\s*(?:please\s+)?(?:play|make|create|generate|compose|sing|write)\s+(?:me\s+)?(?:an?\s+)?(?:song|music|melody|tune|track|beat|instrumental|jingle|anthem)\s*(?:of|about|for|called|:|with)?\s*(.{3,})$/is,
  /^\s*(?:song|music|melody|tune|beat)\s*(?:about|of|:|with)\s*(.{3,})$/is,
];

export function detectMusicPrompt(text: string): string | null {
  const raw = (text || '').trim();
  if (raw.length < 4) return null;
  for (const re of MUSIC_TRIGGERS) {
    const m = raw.match(re);
    if (!m) continue;
    const prompt = (m[1] || '').replace(/["“”'‘’]/g, '').replace(/\s+/g, ' ').trim();
    if (prompt.length >= 3) return prompt.slice(0, 400);
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
export function estimateText(kind: 'music' | 'video'): string {
  return kind === 'music'
    ? '🎵 بعزّف لك اللحن… (~1-2 دقيقة)'
    : '🎬 بجهّز لك الفيديو… (~3-15 دقيقة، راح أعدّل الرسالة لما يخلص)';
}
