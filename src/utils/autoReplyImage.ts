// ============================================
// Omni Bot - Auto Reply Image
// تحميل صورة من الجهاز/الرابط وضغطها وتجهيزها للتخزين
// ============================================

import axios from 'axios';
import { createLogger } from './helpers';

const logger = createLogger('AutoReplyImage');

/** أقصى حجم للملف الأصلي قبل الضغط */
export const AUTO_REPLY_IMAGE_MAX_INPUT = 12 * 1024 * 1024; // 12MB
/** أقصى حجم للصورة بعد الضغط — base64 يزيد الحجم ~33% لكنه يبقى ضمن حدود Mongo */
export const AUTO_REPLY_IMAGE_MAX_STORED = 1_500_000; // 1.5MB
/** أقصى أبعاد بعد الضغط — نرفعها للحفاظ على جودة اللافتات/البانرات */
const MAX_DIMENSION = 1600;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface PreparedAutoReplyImage {
  base64: string;
  mimeType: string;
  /** الاسم الأصلي للعرض فقط — اسم المرفق في ديسكورد ثابت وآمن */
  name: string;
  bytes: number;
  width?: number;
  height?: number;
}

function cleanMime(raw: string): string {
  return String(raw || '').toLowerCase().split(';')[0].trim();
}

function inferMime(name: string): string {
  const ext = String(name || '').toLowerCase().split('.').pop() || '';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return '';
}

export function extensionForMime(mime: string): string {
  return MIME_EXT[cleanMime(mime)] || 'jpg';
}

/** اسم مرفق ثابت وآمن لاستخدامه في attachment:// */
export function autoReplyAttachmentName(mime: string): string {
  return `auto-reply.${extensionForMime(mime)}`;
}

/** فك base64 المحفوظ مع حدود أمان */
export function getAutoReplyImageBuffer(cfg: any): Buffer | null {
  const raw = String(cfg?.imageData || '').trim();
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length) return null;
    if (buf.length > AUTO_REPLY_IMAGE_MAX_STORED + 512 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

/** تنزيل مرفق ديسكورد مع حد أقصى للحجم */
export async function downloadAutoReplyAttachment(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20_000,
    maxContentLength: AUTO_REPLY_IMAGE_MAX_INPUT,
    maxBodyLength: AUTO_REPLY_IMAGE_MAX_INPUT,
    headers: { 'User-Agent': 'OmniBot/2.0' },
  });
  return Buffer.from(res.data);
}

interface TrimBox {
  x: number;
  y: number;
  w: number;
  h: number;
  hasTransparency: boolean;
  bg: [number, number, number];
}

function channelDist(data: Uint8ClampedArray, i: number, bg: [number, number, number]): number {
  return Math.max(
    Math.abs(data[i] - bg[0]),
    Math.abs(data[i + 1] - bg[1]),
    Math.abs(data[i + 2] - bg[2]),
  );
}

/**
 * تحليل الصورة المطلوبة وتحديد حدود المحتوى الفعلي (بدون الهوامش الشفافة/الموحدة).
 * - لو فيها شفافية: المحتوى = أي بكسل alpha > 24.
 * - لو بدون شفافية: المحتوى = أي بكسل يختلف عن لون الخلفية (المُستنتج من الزوايا) بأكثر من 32.
 * ترجع null لو الصورة "صاخبة" (لا توجد هوامش موحدة واضحة) — يعني بلا قص.
 */
function analyzeTrimBox(data: Uint8ClampedArray, w: number, h: number): TrimBox | null {
  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      hasTransparency = true;
      break;
    }
  }

  const corners = [
    0,
    (w - 1) * 4,
    (h - 1) * w * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  const r = Math.round(corners.reduce((s, i) => s + data[i], 0) / 4);
  const g = Math.round(corners.reduce((s, i) => s + data[i + 1], 0) / 4);
  const b = Math.round(corners.reduce((s, i) => s + data[i + 2], 0) / 4);
  const bg: [number, number, number] = [r, g, b];

  // تأكد أن الزوايا متقاربة — وإلا فالصورة ليست "لافتة على خلفية موحدة"
  const cornersClose = corners.every((i) => channelDist(data, i, bg) <= 48);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  const step = w * h > 3_000_000 ? 2 : 1; // صور ضخمة جداً: عيّنة كل بكسلين لتسريع المسح
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      let content: boolean;
      if (hasTransparency) {
        content = data[i + 3] > 24;
      } else if (cornersClose) {
        content = channelDist(data, i, bg) > 32;
      } else {
        content = true; // صورة صاخبة — لا قص
      }
      if (content) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null; // الصورة فارغة بالكامل
  // لو القص أصغر من 5% من المساحة أو أقل من 8px من كل ناحية — لا فائدة
  const trimmedW = maxX - minX + 1;
  const trimmedH = maxY - minY + 1;
  if (trimmedW >= w - 2 && trimmedH >= h - 2) return { x: 0, y: 0, w, h, hasTransparency, bg };
  if (trimmedW < 8 || trimmedH < 8) return { x: 0, y: 0, w, h, hasTransparency, bg };
  return { x: minX, y: minY, w: trimmedW, h: trimmedH, hasTransparency, bg };
}

/** قص الصورة إلى حدود المحتوى ثم تصغيرها إن لزم — بجودة عالية */
async function cropAndScale(
  img: any,
  box: TrimBox,
  maxDim: number,
): Promise<any> {
  const { createCanvas } = require('@napi-rs/canvas');
  const cropped = createCanvas(box.w, box.h);
  const cctx = cropped.getContext('2d');
  cctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);

  const scale = Math.min(1, maxDim / Math.max(box.w, box.h));
  if (scale >= 1) return cropped;

  const out = createCanvas(Math.max(1, Math.round(box.w * scale)), Math.max(1, Math.round(box.h * scale)));
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(cropped, 0, 0, out.width, out.height);
  return out;
}

/**
 * ضغط الصورة وتجهيزها للتخزين.
 * - الهوامش الشفافة/الموحدة تُقص تلقائياً.
 * - الصور فيها شفافية تبقى شفافة (PNG/WebP) بدل تحويلها لأبيض.
 * - جودة JPEG تبدأ عالية (0.92) وتنخفض تدريجياً فقط لو لزم.
 */
export async function prepareAutoReplyImage(
  buffer: Buffer,
  mimeType: string,
  originalName = ''
): Promise<PreparedAutoReplyImage> {
  if (!buffer.length) throw new Error('الصورة فارغة');
  if (buffer.length > AUTO_REPLY_IMAGE_MAX_INPUT) {
    throw new Error('حجم الصورة كبير جداً — الحد الأقصى 12MB');
  }

  const mime = cleanMime(mimeType) || inferMime(originalName);
  if (!mime.startsWith('image/')) throw new Error('الملف المرفق ليس صورة');

  const displayName = String(originalName || 'auto-reply').slice(0, 180);

  // 🎞️ احتفظ بـ GIF الصغير كما هو حتى لا تفقد الحركة
  if (mime === 'image/gif' && buffer.length <= AUTO_REPLY_IMAGE_MAX_STORED) {
    return {
      base64: buffer.toString('base64'),
      mimeType: 'image/gif',
      name: displayName,
      bytes: buffer.length,
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadImage, createCanvas } = require('@napi-rs/canvas');
    const img = await loadImage(buffer);

    // ارسم بالحجم الأصلي لتحليل المحتوى
    const nat = createCanvas(img.width, img.height);
    const nctx = nat.getContext('2d');
    nctx.drawImage(img, 0, 0);
    const { data } = nctx.getImageData(0, 0, img.width, img.height);
    const box = analyzeTrimBox(data, img.width, img.height);

    const effectiveBox: TrimBox = box || {
      x: 0,
      y: 0,
      w: img.width,
      h: img.height,
      hasTransparency: false,
      bg: [255, 255, 255],
    };

    // قرار الترميز: شفاف → WebP/PNG، وإلا JPEG عالي الجودة
    const attempts: Array<{ maxDim: number; quality: number; type: string }> = [];
    if (effectiveBox.hasTransparency) {
      attempts.push(
        { maxDim: MAX_DIMENSION, quality: 0.95, type: 'image/webp' },
        { maxDim: MAX_DIMENSION, quality: 0.9, type: 'image/webp' },
        { maxDim: 1200, quality: 0.9, type: 'image/webp' },
        { maxDim: MAX_DIMENSION, quality: 1, type: 'image/png' },
        { maxDim: 1000, quality: 0.85, type: 'image/webp' },
      );
    } else {
      attempts.push(
        { maxDim: MAX_DIMENSION, quality: 0.92, type: 'image/jpeg' },
        { maxDim: MAX_DIMENSION, quality: 0.85, type: 'image/jpeg' },
        { maxDim: MAX_DIMENSION, quality: 0.75, type: 'image/jpeg' },
        { maxDim: 1200, quality: 0.85, type: 'image/jpeg' },
        { maxDim: 1000, quality: 0.72, type: 'image/jpeg' },
      );
    }

    const fillWhite = (src: any): any => {
      const filled = createCanvas(src.width, src.height);
      const fctx = filled.getContext('2d');
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, filled.width, filled.height);
      fctx.drawImage(src, 0, 0);
      return filled;
    };

    let lastSize = 0;
    for (const attempt of attempts) {
      const canvas = await cropAndScale(img, effectiveBox, attempt.maxDim);
      const target = attempt.type === 'image/jpeg' ? fillWhite(canvas) : canvas;

      let out: Buffer | null = null;
      try {
        out = target.toBuffer(attempt.type as any, attempt.quality);
      } catch {
        out = null; // نوع غير مدعوم (مثل webp في نسخة canvas قديمة) — جرّب التالي
      }

      if (!out || !out.length) continue;
      lastSize = out.length;
      if (out.length > AUTO_REPLY_IMAGE_MAX_STORED) continue;

      const ext = extensionForMime(attempt.type);
      const nameOut = displayName.replace(/\.[^.]+$/, '') + '.' + ext;
      logger.info(
        `Auto-reply image ready: ${buffer.length} → ${out.length} bytes (${canvas.width}x${canvas.height}, ${attempt.type})`
      );
      return {
        base64: out.toString('base64'),
        mimeType: attempt.type,
        name: nameOut,
        bytes: out.length,
        width: canvas.width,
        height: canvas.height,
      };
    }

    // آخر ملاذ: JPEG على 1000px بأبعاد أصغر حتى يدخل الحد
    const fallbackDim = 800;
    const canvas = await cropAndScale(img, effectiveBox, fallbackDim);
    const filled = createCanvas(canvas.width, canvas.height);
    const fctx = filled.getContext('2d');
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, filled.width, filled.height);
    fctx.drawImage(canvas, 0, 0);
    const out = filled.toBuffer('image/jpeg', 0.65);
    lastSize = out.length;
    if (out.length > AUTO_REPLY_IMAGE_MAX_STORED) {
      throw new Error(`تعذّر ضغط الصورة لحجم مناسب (آخر حجم: ${lastSize} بايت)`);
    }
    return {
      base64: out.toString('base64'),
      mimeType: 'image/jpeg',
      name: displayName.replace(/\.[^.]+$/, '') + '.jpg',
      bytes: out.length,
      width: filled.width,
      height: filled.height,
    };
  } catch (err: any) {
    // لو الصورة أصلها صغيرة ومدعومة، احفظها كما هي بدل الفشل
    if (buffer.length <= AUTO_REPLY_IMAGE_MAX_STORED && MIME_EXT[mime]) {
      return {
        base64: buffer.toString('base64'),
        mimeType: MIME_EXT[mime] === 'jpg' ? 'image/jpeg' : mime,
        name: displayName,
        bytes: buffer.length,
      };
    }
    logger.warn(`Auto-reply image prepare failed: ${err?.message || err}`);
    throw new Error('صيغة الصورة غير مدعومة أو تعذّر ضغطها — جرّب JPG أو PNG');
  }
}
