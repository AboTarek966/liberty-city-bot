// ============================================
// Omni Bot - Wheel of Fortune (عجلة الحظ)
// يولّد GIF متحرك لعجلة حظ تختار عضواً/جائزة عشوائياً.
// يُستخدم في /roulette (الأعضاء) و /wheel (الجوائز).
// ============================================

import path from 'path';
import fs from 'fs';
import { createLogger } from './helpers';

const logger = createLogger('WheelOfFortune');

let fontsChecked = false;
let useBundledFonts = false;

/** سجّل الخطوط المضمّنة مع البوت (تعمل بدون أي خطوط نظام) */
function ensureFonts(): boolean {
  if (fontsChecked) return useBundledFonts;
  fontsChecked = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GlobalFonts } = require('@napi-rs/canvas');
    const dir = path.join(__dirname, '..', '..', 'assets', 'fonts');
    const needed = [
      'NotoSans-Regular.ttf',
      'NotoSans-Bold.ttf',
      'NotoSansArabic-Regular.ttf',
      'NotoSansArabic-Bold.ttf',
    ];
    if (needed.every((f) => fs.existsSync(path.join(dir, f)))) {
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSans-Regular.ttf'), 'OmniSans');
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSans-Bold.ttf'), 'OmniSans');
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSansArabic-Regular.ttf'), 'OmniArabic');
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSansArabic-Bold.ttf'), 'OmniArabic');
      useBundledFonts = true;
      return true;
    }
    logger.warn('WheelOfFortune: bundled fonts not found — falling back to system fonts');
  } catch (err: any) {
    logger.warn(`WheelOfFortune: registerFont failed — ${err?.message || err}`);
  }
  useBundledFonts = false;
  return false;
}

const SANS = 'OmniSans';
const AR = 'OmniArabic';
const FALLBACK = 'sans-serif';

function fontFor(text: string, bold = true): string {
  const hasBundled = ensureFonts();
  const isLatinOnly = /^[\x20-\x7E]*$/.test(text);
  if (hasBundled) return `${bold ? 'bold ' : ''}${isLatinOnly ? SANS : AR}`;
  return bold ? 'bold sans-serif' : 'sans-serif';
}

export interface WheelSegmentInput {
  /** النص القصير الذي يظهر على القطعة (يفضل اسم المستخدم/مقبض ديسكورد ASCII) */
  label: string;
  /** صورة دائرية للقطعة (آفاتار عضو أو أيقونة جائزة) — اختياري */
  image?: Buffer | null;
  /** وزن اختياري لعرض قطع بأحجام متفاوتة — التوزيع الفعلي يبقى عشوائياً داخلياً */
  color?: string;
}

export interface WheelOfFortuneOptions {
  title: string;
  subtitle?: string;
  segments: WheelSegmentInput[];
  /** القطعة التي ستستقر عليها العجلة */
  winnerIndex: number;
  width?: number;
  frames?: number;
  delayMs?: number;
  holdMs?: number;
  hubText?: string;
}

const PALETTE = [
  '#dc2626', '#f97316', '#f59e0b', '#16a34a',
  '#0ea5e9', '#7c3aed', '#db2777', '#14b8a6',
];

const TAU = Math.PI * 2;
const POINTER = -Math.PI / 2; // أعلى العجلة

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

async function loadImages(segments: WheelSegmentInput[]): Promise<(any | null)[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { loadImage } = require('@napi-rs/canvas');
  return Promise.all(
    segments.map(async (seg) => {
      if (!seg.image || !seg.image.length) return null;
      try {
        return await loadImage(seg.image);
      } catch {
        return null;
      }
    })
  );
}

/**
 * رسم عجلة الحظ كـ GIF متحرك.
 * @returns Buffer للـ GIF — ارسله كـ attachment.
 */
export async function renderWheelOfFortuneGif(opts: WheelOfFortuneOptions): Promise<Buffer> {
  ensureFonts();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createCanvas } = require('@napi-rs/canvas');

  const W = opts.width || 440;
  const H = Math.round(W * 1.18);
  const frames = Math.max(20, opts.frames || 34);
  const delayMs = opts.delayMs ?? 46;
  const holdMs = opts.holdMs ?? 850;
  const hubText = opts.hubText || 'OMNI';

  const segs = opts.segments.filter(Boolean);
  const n = segs.length;
  if (n < 2 || opts.winnerIndex < 0 || opts.winnerIndex >= n) {
    throw new Error('عجلة الحظ تحتاج قطعتين على الأقل وفائز بينهما');
  }

  const seg = TAU / n;
  const winnerMid = opts.winnerIndex * seg + seg / 2;
  // الاستدارة النهائية تجعل منتصف قطعة الفائز تحت المؤشر (أعلى العجلة)
  let target = POINTER - winnerMid;
  while (target < TAU * 4.5) target += TAU;

  const images = await loadImages(segs);

  const CX = W / 2;
  const CY = Math.round(H * 0.63);
  const R = Math.round(W * 0.335);   // نصف قطر القطع
  const RIM = Math.max(14, Math.round(W * 0.036)); // عرض الإطار الذهبي
  const HUB = Math.round(R * 0.27);
  const SEG_R = R;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  const drawBackground = () => {
    const g = ctx.createRadialGradient(CX, CY, R * 0.2, CX, CY, H);
    g.addColorStop(0, '#1e293b');
    g.addColorStop(0.55, '#0f172a');
    g.addColorStop(1, '#020617');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // خطوط شفافة خفيفة
    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 1;
    for (let r = R * 0.55; r < H; r += R * 0.36) {
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, TAU);
      ctx.stroke();
    }
  };

  const drawTitle = () => {
    const gold = ctx.createLinearGradient(0, 0, 0, H * 0.14);
    gold.addColorStop(0, '#fde68a');
    gold.addColorStop(0.5, '#f59e0b');
    gold.addColorStop(1, '#b45309');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(W * 0.085)}px ${fontFor(opts.title)}`;
    ctx.shadowColor = 'rgba(245,158,11,0.45)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = gold;
    ctx.fillText(opts.title, CX, H * 0.068);
    ctx.shadowBlur = 0;
    if (opts.subtitle) {
      ctx.font = `${Math.round(W * 0.033)}px ${fontFor(opts.subtitle, false)}`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(opts.subtitle, CX, H * 0.125);
    }
    ctx.restore();
  };

  const drawPointer = () => {
    const tipY = CY - R - RIM * 0.4;
    const baseY = Math.max(H * 0.145, tipY - R * 0.5);
    const halfBase = R * 0.11;
    const g = ctx.createLinearGradient(0, baseY, 0, tipY);
    g.addColorStop(0, '#fde047');
    g.addColorStop(1, '#eab308');
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(CX, tipY);
    ctx.lineTo(CX - halfBase, baseY);
    ctx.lineTo(CX + halfBase, baseY);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#713f12';
    ctx.stroke();
    ctx.shadowBlur = 0;
    // مسمار التثبيت
    ctx.beginPath();
    ctx.arc(CX, baseY, Math.max(6, R * 0.045), 0, TAU);
    ctx.fillStyle = '#1f2937';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();
    ctx.restore();
  };

  const drawWheel = (rotation: number, glowWinner: boolean) => {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(rotation);

    for (let i = 0; i < n; i++) {
      const a0 = i * seg;
      const a1 = a0 + seg;
      const mid = a0 + seg / 2;
      const color = segs[i].color || PALETTE[i % PALETTE.length];

      // القطعة
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, SEG_R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // تدرّج داخلي خفيف (عمق)
      const inner = ctx.createRadialGradient(0, 0, SEG_R * 0.15, 0, 0, SEG_R);
      inner.addColorStop(0, 'rgba(255,255,255,0.22)');
      inner.addColorStop(0.75, 'rgba(255,255,255,0)');
      inner.addColorStop(1, 'rgba(0,0,0,0.38)');
      ctx.fillStyle = inner;
      ctx.fill();

      // فواصل ذهبية
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, SEG_R, a0, a1);
      ctx.closePath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(2,6,23,0.85)';
      ctx.stroke();

      if (glowWinner && i === opts.winnerIndex) {
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 26;
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, SEG_R - 4, a0 + 0.02, a1 - 0.02);
        ctx.stroke();
        ctx.restore();
      }

      const avatar = images[i];
      const avatarR = Math.max(18, Math.min(30, SEG_R * (n <= 4 ? 0.19 : n <= 6 ? 0.16 : 0.135)));
      const avatarDist = SEG_R * 0.66;

      if (avatar) {
        // آفاتار دائري داخل القطعة
        const ax = Math.cos(mid) * avatarDist;
        const ay = Math.sin(mid) * avatarDist;
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, avatarR + 3, 0, TAU);
        ctx.fillStyle = 'rgba(2,6,23,0.75)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ax, ay, avatarR, 0, TAU);
        ctx.closePath();
        ctx.clip();
        const side = avatarR * 2;
        ctx.drawImage(avatar, ax - side / 2, ay - side / 2, side, side);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(ax, ay, avatarR, 0, TAU);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fbbf24';
        ctx.stroke();
      } else {
        // حرف بدلاً من الآفاتار
        const ax = Math.cos(mid) * avatarDist;
        const ay = Math.sin(mid) * avatarDist;
        ctx.beginPath();
        ctx.arc(ax, ay, avatarR, 0, TAU);
        ctx.fillStyle = 'rgba(2,6,23,0.7)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fbbf24';
        ctx.stroke();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.round(avatarR * 1.15)}px ${fontFor(segs[i].label)}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText((segs[i].label || '?').trim().charAt(0).toUpperCase(), ax, ay + 1);
        ctx.restore();
      }

      // الاسم على امتداد نصف القطر (باتجاه المركز → الحافة)
      ctx.save();
      ctx.rotate(mid);
      ctx.translate(SEG_R * 0.34, 0);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = String(segs[i].label || '').slice(0, 12);
      ctx.font = `bold ${Math.max(12, Math.round(W * 0.032))}px ${fontFor(label)}`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(2,6,23,0.9)';
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // الإطار الذهبي الخارجي
    const rim = ctx.createLinearGradient(-SEG_R, -SEG_R, SEG_R, SEG_R);
    rim.addColorStop(0, '#fef3c7');
    rim.addColorStop(0.25, '#f59e0b');
    rim.addColorStop(0.5, '#92400e');
    rim.addColorStop(0.75, '#fbbf24');
    rim.addColorStop(1, '#78350f');
    ctx.beginPath();
    ctx.arc(0, 0, SEG_R + RIM * 0.5, 0, TAU);
    ctx.lineWidth = RIM;
    ctx.strokeStyle = rim;
    ctx.stroke();
    // براغٍ على الإطار
    const rivetR = SEG_R + RIM * 0.5;
    const rivets = 18;
    for (let i = 0; i < rivets; i++) {
      const a = (i / rivets) * TAU;
      const rx = Math.cos(a) * rivetR;
      const ry = Math.sin(a) * rivetR;
      ctx.beginPath();
      ctx.arc(rx, ry, RIM * 0.22, 0, TAU);
      const rg = ctx.createRadialGradient(rx - 1, ry - 1, 0.5, rx, ry, RIM * 0.3);
      rg.addColorStop(0, '#fffbeb');
      rg.addColorStop(0.6, '#d4a017');
      rg.addColorStop(1, '#451a03');
      ctx.fillStyle = rg;
      ctx.fill();
    }
    // الحلقة الداخلية
    ctx.beginPath();
    ctx.arc(0, 0, SEG_R, 0, TAU);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(254,243,199,0.65)';
    ctx.stroke();

    // المركز (المحور)
    ctx.beginPath();
    ctx.arc(0, 0, HUB, 0, TAU);
    const hub = ctx.createRadialGradient(-HUB * 0.35, -HUB * 0.35, HUB * 0.1, 0, 0, HUB);
    hub.addColorStop(0, '#fda4af');
    hub.addColorStop(0.35, '#e11d48');
    hub.addColorStop(1, '#4c0519');
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(HUB * 0.52)}px ${fontFor(hubText)}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(76,5,25,0.9)';
    ctx.strokeText(hubText, 0, 1);
    ctx.fillStyle = '#fff7ed';
    ctx.fillText(hubText, 0, 1);
    ctx.restore();

    ctx.restore();
  };

  // إطار ثابت نهائي: هالة ذهبية تضيء حول العجلة يومض
  const drawFinalOverlay = () => {
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 34;
    ctx.beginPath();
    ctx.arc(CX, CY, SEG_R + RIM, 0, TAU);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,215,0,0.9)';
    ctx.stroke();
    ctx.restore();
  };

  const frameCount = frames + 1; // + إطار ثابت أخير لإبراز الفائز

  // 🎨 لوحة ألوان واحدة لكل الإطارات (من إطار منتصف الحركة) — أسرع وأخف على الذاكرة
  const sampleRotation = easeOutQuart(0.4) * target;
  drawBackground();
  drawTitle();
  drawWheel(sampleRotation, false);
  drawPointer();
  const { data: sampleData } = ctx.getImageData(0, 0, W, H);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GIFEncoder, quantize, applyPalette } = require('gifenc');
  const palette = quantize(sampleData as any, 224);

  const gif = GIFEncoder();
  for (let i = 0; i < frameCount; i++) {
    const isFinal = i === frameCount - 1;
    const t = isFinal ? 1 : i / (frames - 1);
    const rotation = easeOutQuart(t) * target;
    const glow = isFinal || t > 0.93;

    drawBackground();
    drawTitle();
    drawWheel(rotation, glow);
    drawPointer();
    if (isFinal) drawFinalOverlay();

    const { data } = ctx.getImageData(0, 0, W, H);
    const index = applyPalette(data as any, palette);
    gif.writeFrame(index, W, H, { palette, delay: isFinal ? holdMs : delayMs, transparent: false });
  }
  gif.finish();
  const out = Buffer.from(gif.bytes());
  logger.info(`🎡 wheel GIF rendered: ${out.length} bytes in ${frameCount} frames (${W}x${H})`);
  return out;
}

/** تحميل آفاتار ديسكورد كـ Buffer (null عند الفشل — لا تُرمي) */
export async function fetchAvatarBuffer(url: string): Promise<Buffer | null> {
  try {
    const axios = require('axios');
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      maxContentLength: 4 * 1024 * 1024,
      maxBodyLength: 4 * 1024 * 1024,
    });
    const buf = Buffer.from(res.data);
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}
