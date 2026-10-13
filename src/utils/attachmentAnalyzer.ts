// ============================================
// Liberty City Bot - محلّل الوسائط للذكاء الاصطناعي
// يفهم: الصور (رؤية) · الرسائل الصوتية (تفريغ) · الفيديو (إطارات + صوت) · الملفات النصية
//
// يعمل على Groq المجاني:
//   - رؤية الصور: llama-4-scout / qwen3-vl
//   - تفريغ الصوت: whisper-large-v3-turbo
// ============================================

import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createLogger } from './helpers';

const execFileP = promisify(execFile);
const logger = createLogger('AttachmentAI');

// ---------- إعدادات ----------
/** موديلات الرؤية على Groq (مرتّبة بالأفضل) */
export const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3-vl-235b-a22b-instruct',
  'llama-3.2-11b-vision-instruct',
];

/** موديلات التفريغ الصوتي (STT) على Groq */
export const STT_MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3'];

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const MAX_DOWNLOAD_BYTES = 24 * 1024 * 1024; // 24MB حد أقصى للتنزيل
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024; // 3.5MB حد base64 الآمن
const VIDEO_MAX_BYTES = 14 * 1024 * 1024; // 14MB حد الفيديو (حماية الذاكرة)
const REQUEST_TIMEOUT = 45_000;

export interface AttachmentAnalysis {
  /** نص وصفي جاهز لحقنه في سياق الـ AI */
  context: string;
  /** هل تم تحليل شيء فعلياً */
  analyzed: boolean;
  /** الصور كـ base64 — تُمرَّر مباشرة لنموذج الرؤية */
  images: Array<{ data: string; mimeType: string }>;
  /** عدد الوسائط التي عالجها */
  processed: number;
}

/** نوع الوسائط */
type MediaKind = 'image' | 'voice' | 'video' | 'audio' | 'text' | 'other';

function classify(att: {
  contentType?: string | null;
  name?: string | null;
  duration?: number | null;
  flags?: number | null;
  height?: number | null;
}): MediaKind {
  const ct = (att.contentType || '').toLowerCase();
  const name = (att.name || '').toLowerCase();

  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('audio/')) return att.duration ? 'voice' : 'audio';
  if (ct.startsWith('video/')) return 'video';

  // Discord يعلّم الرسائل الصوتية بالـ flag (1 << 13) أو بمدة + بدون نص
  const isVoiceFlag = typeof att.flags === 'number' && (att.flags & (1 << 13)) !== 0;
  if (isVoiceFlag) return 'voice';

  if (/\.(png|jpe?g|gif|webp|bmp)$/.test(name)) return 'image';
  if (/\.(ogg|oga|opus|mp3|wav|m4a|aac|flac)$/.test(name)) return att.duration ? 'voice' : 'audio';
  if (/\.(mp4|webm|mov|mkv|avi|m4v)$/.test(name)) return 'video';
  if (/\.(txt|md|json|js|ts|py|java|c|cpp|cs|html|css|xml|yml|yaml|log|csv|ini|cfg|sh|sql)$/.test(name)) return 'text';

  return 'other';
}

/** تنزيل ملف من Discord CDN بأمان */
async function download(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    maxContentLength: MAX_DOWNLOAD_BYTES,
    timeout: REQUEST_TIMEOUT,
    headers: { 'User-Agent': 'LibertyCityBot/2.0' },
  });
  return Buffer.from(res.data);
}

/** تصغير صورة عبر canvas لو كانت كبيرة جداً — يقلل الذاكرة وسرعة الرفع */
async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  if (buffer.length <= MAX_IMAGE_BYTES) return buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadImage, createCanvas } = require('@napi-rs/canvas');
    const img = await loadImage(buffer);
    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = createCanvas(w, h);
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = canvas.toBuffer('image/jpeg', 0.82);
    logger.info(`Image optimized: ${buffer.length} → ${out.length} bytes`);
    return out;
  } catch (e: any) {
    logger.warn(`Image optimization failed: ${e.message}`);
    return buffer;
  }
}

/** استدعاء Groq — رؤية الصور */
async function groqVision(
  apiKey: string,
  prompt: string,
  images: Array<{ data: string; mimeType: string }>
): Promise<string> {
  let lastErr: any = null;
  for (const model of VISION_MODELS) {
    try {
      const OpenAI = require('openai');
      const client = new OpenAI({ apiKey, baseURL: GROQ_BASE, timeout: REQUEST_TIMEOUT });

      const content: any[] = [{ type: 'text', text: prompt }];
      for (const img of images) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.data}` },
        });
      }

      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content }],
        max_tokens: 700,
        temperature: 0.3,
      });

      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e: any) {
      lastErr = e;
      const status = Number(e?.status ?? e?.response?.status ?? 0);
      if (status !== 400 && status !== 404 && status !== 429) break;
    }
  }
  throw lastErr || new Error('vision failed');
}

/** استدعاء Groq — تفريغ الصوت إلى نص (Whisper) */
async function groqTranscribe(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  let lastErr: any = null;
  for (const model of STT_MODELS) {
    try {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
      form.append('model', model);
      form.append('response_format', 'json');
      form.append('temperature', '0');

      const res: any = await axios.post(`${GROQ_BASE}/audio/transcriptions`, form, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 60_000,
        maxBodyLength: MAX_DOWNLOAD_BYTES,
      });

      const text = (res.data?.text || '').trim();
      if (text) return text;
      return '';
    } catch (e: any) {
      lastErr = e;
      const status = Number(e?.status ?? e?.response?.status ?? 0);
      if (status !== 400 && status !== 404 && status !== 429) break;
    }
  }
  throw lastErr || new Error('transcription failed');
}

/** إيجاد ffmpeg (من النظام أو من الحزمة الاختيارية) */
function resolveFfmpeg(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require('ffmpeg-static');
    if (p && typeof p === 'string' && fs.existsSync(p)) return p;
  } catch { /* غير مثبت — نجرب مسار النظام */ }
  return 'ffmpeg'; // نفترض أنه في PATH (سيفشل بأمان لو مش موجود)
}

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileP(resolveFfmpeg()!, args, {
    timeout: 90_000,
    maxBuffer: 1024 * 1024 * 16,
    windowsHide: true,
  });
}

/** تحليل فيديو: استخراج إطارات + تفريغ الصوت */
async function analyzeVideo(
  buffer: Buffer,
  filename: string,
  apiKey: string,
  question: string
): Promise<{ context: string; images: AttachmentAnalysis['images'] }> {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lcvid-'));
  const inPath = path.join(tmp, 'in.mp4');
  const audioPath = path.join(tmp, 'audio.mp3');
  const notes: string[] = [];
  const images: AttachmentAnalysis['images'] = [];

  try {
    await fs.promises.writeFile(inPath, buffer);

    // ① استخراج3إطارات موزّعة على طول الفيديو
    try {
      const { stdout: durOut } = await execFileP(resolveFfmpeg()!, ['-i', inPath, '-f', 'null', '-'], {
        timeout: 30_000, maxBuffer: 1024 * 1024 * 4, windowsHide: true,
      }).catch(() => ({ stdout: '' }));
      const durMatch = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(durOut || '');
      const totalSec = durMatch
        ? parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3])
        : 0;

      const frameCount = 3;
      for (let i = 0; i < frameCount; i++) {
        const ts = totalSec > 0 ? ((totalSec * (i + 1)) / (frameCount + 1)).toFixed(2) : String(i * 3);
        const out = path.join(tmp, `frame${i}.jpg`);
        await runFfmpeg(['-ss', ts, '-i', inPath, '-frames:v', '1', '-q:v', '4', '-vf', 'scale=960:-1', out, '-y']);
        const b = await fs.promises.readFile(out);
        if (b.length > 0) {
          images.push({ data: b.toString('base64'), mimeType: 'image/jpeg' });
        }
      }
      if (images.length) notes.push(`${images.length} إطارات مستخرجة من الفيديو`);
    } catch (e: any) {
      logger.warn(`Video frame extraction failed: ${e.message}`);
    }

    // ② تفريغ الصوت
    try {
      await runFfmpeg(['-i', inPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', audioPath, '-y']);
      const audioBuf = await fs.promises.readFile(audioPath);
      if (audioBuf.length > 0 && apiKey) {
        const speech = await groqTranscribe(apiKey, audioBuf, 'audio.mp3', 'audio/mpeg');
        if (speech) notes.push(`**الصوت داخل الفيديو (تفريغ):** ${speech.slice(0, 1200)}`);
      }
    } catch (e: any) {
      logger.warn(`Video audio transcription failed: ${e.message}`);
    }

    if (!notes.length) {
      return {
        context: `[فيديو مرفق: "${filename}" — ${Math.round(buffer.length / 1024)}KB — تعذّر تحليله (قد يكون كبيراً أو بصيغة غير مدعومة). اطلب من المستخدم لقطة شاشة أو وصفاً نصياً.]`,
        images,
      };
    }

    const extra = question ? `\nسؤال المستخدم المرتبط بالفيديو: "${question}"` : '';
    return {
      context: `[مرفق فيديو: "${filename}"\n${notes.join('\n')}${extra}]`,
      images,
    };
  } finally {
    try { await fs.promises.rm(tmp, { recursive: true, force: true }); } catch { /* تجاهل */ }
  }
}

// --------------------------------------------
// المدخل الرئيسي
// --------------------------------------------
export async function analyzeAttachments(
  attachments: Array<{
    id: string;
    name?: string | null;
    url: string;
    contentType?: string | null;
    size?: number | null;
    duration?: number | null;
    flags?: number | null;
    height?: number | null;
    width?: number | null;
  }>,
  opts: { apiKey?: string; question?: string; canSeeImages?: boolean }
): Promise<AttachmentAnalysis> {
  const empty: AttachmentAnalysis = { context: '', analyzed: false, images: [], processed: 0 };
  if (!attachments?.length) return empty;

  const { apiKey = '', question = '', canSeeImages = true } = opts;
  const parts: string[] = [];
  const images: AttachmentAnalysis['images'] = [];
  let processed = 0;

  // حد أقصى: نعالج أول4وسائط فقط (حماية للذاكرة والزمن)
  const list = attachments.slice(0, 4);

  for (const att of list) {
    const kind = classify(att);
    const sizeKb = Math.round((att.size || 0) / 1024);
    const name = att.name || 'ملف';

    try {
      // ---- صور ----
      if (kind === 'image') {
        if (!apiKey) { parts.push(`[صورة مرفقة: "${name}" — لا يمكن تحليلها بدون مفتاح AI]`); continue; }
        const raw = await download(att.url);
        const buf = await optimizeImage(raw);
        const b64 = buf.toString('base64');
        const mime = (att.contentType || 'image/png').split(';')[0];

        const header = `[صورة مرفقة: "${name}" — ${att.width || '?'}×${att.height || '?'}]`;

        // مزوّد يدعم الرؤية (Gemini) → نمرّر الصورة نفسها مباشرة (أدق وأسرع من وصف منفصل)
        if (canSeeImages) {
          parts.push(`${header} — تظهر لك مباشرة، انظر إليها وأجب.`);
          images.push({ data: b64, mimeType: mime });
          processed++;
          continue;
        }

        // لا يوجد مزوّد رؤية → نخبر النموذج بصراحة أنه لا يراها (لا ندّعي العكس)
        parts.push(`${header} — أُرفقت لكن لا يمكنني رؤيتها حالياً (مزوّد الرؤية غير مُفعّل). اطلب من المستخدم وصفها نصياً.`);
        continue;
      }

      // ---- رسائل صوتية / ملفات صوتية: تفريغ ----
      if (kind === 'voice' || kind === 'audio') {
        if (!apiKey) { parts.push(`[ملف صوتي مرفق: "${name}" — لا يمكن تفريغه بدون مفتاح AI]`); continue; }
        if (sizeKb > 8000) { parts.push(`[ملف صوتي مرفق: "${name}" — ${sizeKb}KB أكبر من الحد المسموح للتفريغ]`); continue; }

        const raw = await download(att.url);
        const mime = (att.contentType || 'audio/ogg').split(';')[0];
        const speech = await groqTranscribe(apiKey, raw, name, mime);
        if (speech) {
          const label = kind === 'voice' ? 'رسالة صوتية' : 'ملف صوتي';
          parts.push(`[${label} مرفق: "${name}"${att.duration ? ` — ${Math.round(att.duration)} ثانية` : ''}]\n**النص المفرَّغ:** ${speech.slice(0, 2000)}`);
          processed++;
        } else {
          parts.push(`[${kind === 'voice' ? 'رسالة صوتية' : 'ملف صوتي'} مرفق: "${name}" — لم يحتوِ على كلام واضح]`);
        }
        continue;
      }

      // ---- فيديو: إطارات + صوت ----
      if (kind === 'video') {
        if (sizeKb > VIDEO_MAX_BYTES / 1024) {
          parts.push(`[فيديو مرفق: "${name}" — ${sizeKb}KB أكبر من الحد المسموح للتحليل]`);
          continue;
        }
        const raw = await download(att.url);
        const r = await analyzeVideo(raw, name, apiKey, question);
        if (r.context) parts.push(r.context);
        for (const im of r.images) images.push(im);
        processed++;
        continue;
      }

      // ---- ملفات نصية/شيفرة ----
      if (kind === 'text') {
        if ((att.size || 0) > 200_000) { parts.push(`[ملف نصي مرفق: "${name}" — كبير جداً للعرض]`); continue; }
        const raw = await download(att.url);
        const text = raw.toString('utf-8').slice(0, 6000);
        parts.push(`[ملف نصي مرفق: "${name}"]\n\`\`\`\n${text}\n\`\`\``);
        processed++;
        continue;
      }

      // ---- أنواع أخرى ----
      parts.push(`[مرفق ملف: "${name}" — ${att.contentType || 'نوع غير معروف'} — ${sizeKb}KB — لم يتم تحليله]`);
    } catch (e: any) {
      logger.warn(`Attachment analysis failed (${name}): ${e.message}`);
      parts.push(`[مرفق: "${name}" — تعذّر تحليله: ${String(e?.message || e).slice(0, 120)}]`);
    }
  }

  // وسائط إضافية لم نعالِجها
  if (attachments.length > list.length) {
    parts.push(`[وسائط إضافية غير معالَجة: ${attachments.length - list.length}]`);
  }

  return {
    context: parts.join('\n\n'),
    analyzed: processed > 0,
    images,
    processed,
  };
}

/** هل يحتوي الرسالة على وسائط قابلة للتحليل؟ */
export function hasAnalyzableAttachments(attachments: Array<{ contentType?: string | null; name?: string | null; flags?: number | null }>): boolean {
  return (attachments || []).some(a => {
    const k = classify(a as any);
    return k !== 'other';
  });
}
