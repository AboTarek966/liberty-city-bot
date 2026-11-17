"use strict";
// ============================================
// Omni Bot - Wheel of Fortune (عجلة الحظ)
// يولّد GIF متحرك لعجلة حظ تختار عضواً/جائزة عشوائياً.
// يُستخدم في /roulette (الأعضاء) و /wheel (الجوائز).
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderWheelOfFortuneGif = renderWheelOfFortuneGif;
exports.fetchAvatarBuffer = fetchAvatarBuffer;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('WheelOfFortune');
// 🗜️ كاش صغير لصور PNG الثابتة — يمنع إعادة الرسم المكلفة عند تكرار نفس الجولة/الفائز
const PNG_CACHE_MAX = 48;
const pngRenderCache = new Map();
function pngCacheKey(opts) {
    const normalizedSegments = (opts.segments || [])
        .filter(Boolean)
        .map((s) => `${String(s.label || '').slice(0, 24)}|${s.image ? 'img' : 'txt'}`)
        .join('~');
    return [
        opts.orientation || 'portrait',
        opts.width || '',
        opts.winnerIndex,
        String(opts.title || '').slice(0, 40),
        String(opts.subtitle || '').slice(0, 60),
        String(opts.hubText || '').slice(0, 24),
        String(opts.resultLabel || '').slice(0, 32),
        normalizedSegments,
    ].join('::');
}
function pngCacheGet(key) {
    const hit = pngRenderCache.get(key);
    if (!hit)
        return undefined;
    // أعد التفعيل لتجديد موضعه (تقريب LRU)
    pngRenderCache.delete(key);
    pngRenderCache.set(key, hit);
    return hit;
}
function pngCacheSet(key, value) {
    if (pngRenderCache.has(key))
        pngRenderCache.delete(key);
    pngRenderCache.set(key, value);
    while (pngRenderCache.size > PNG_CACHE_MAX) {
        const firstKey = pngRenderCache.keys().next().value;
        if (firstKey === undefined)
            break;
        pngRenderCache.delete(firstKey);
    }
}
let fontsChecked = false;
let useBundledFonts = false;
/** سجّل الخطوط المضمّنة مع البوت (تعمل بدون أي خطوط نظام) */
function ensureFonts() {
    if (fontsChecked)
        return useBundledFonts;
    fontsChecked = true;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { GlobalFonts } = require('@napi-rs/canvas');
        const dir = path_1.default.join(__dirname, '..', '..', 'assets', 'fonts');
        const needed = [
            'NotoSans-Regular.ttf',
            'NotoSans-Bold.ttf',
            'NotoSansArabic-Regular.ttf',
            'NotoSansArabic-Bold.ttf',
        ];
        if (needed.every((f) => fs_1.default.existsSync(path_1.default.join(dir, f)))) {
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSans-Regular.ttf'), 'OmniSans');
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSans-Bold.ttf'), 'OmniSans');
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSansArabic-Regular.ttf'), 'OmniArabic');
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSansArabic-Bold.ttf'), 'OmniArabic');
            useBundledFonts = true;
            return true;
        }
        logger.warn('WheelOfFortune: bundled fonts not found — falling back to system fonts');
    }
    catch (err) {
        logger.warn(`WheelOfFortune: registerFont failed — ${err?.message || err}`);
    }
    useBundledFonts = false;
    return false;
}
const SANS = 'OmniSans';
const AR = 'OmniArabic';
const FALLBACK = 'sans-serif';
function fontFor(text, bold = true) {
    const hasBundled = ensureFonts();
    const isLatinOnly = /^[\x20-\x7E]*$/.test(text);
    if (hasBundled)
        return `${bold ? 'bold ' : ''}${isLatinOnly ? SANS : AR}`;
    return bold ? 'bold sans-serif' : 'sans-serif';
}
const PALETTE = [
    '#dc2626', '#f97316', '#f59e0b', '#16a34a',
    '#0ea5e9', '#7c3aed', '#db2777', '#14b8a6',
];
const TAU = Math.PI * 2;
const POINTER = -Math.PI / 2; // أعلى العجلة
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
async function loadImages(segments) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadImage } = require('@napi-rs/canvas');
    return Promise.all(segments.map(async (seg) => {
        if (!seg.image || !seg.image.length)
            return null;
        try {
            return await loadImage(seg.image);
        }
        catch {
            return null;
        }
    }));
}
/**
 * رسم عجلة الحظ كـ GIF متحرك.
 * @returns Buffer للـ GIF — ارسله كـ attachment.
 */
async function renderWheelOfFortuneGif(opts) {
    ensureFonts();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require('@napi-rs/canvas');
    const isLandscape = opts.orientation === 'landscape';
    const W = opts.width || (isLandscape ? 1280 : 440);
    const H = isLandscape ? Math.round(W * 0.5625) : Math.round(W * 1.18); // 16:9 أو عمودي
    const frames = Math.max(8, opts.frames || (isLandscape ? 30 : 34));
    const delayMs = opts.delayMs ?? 46;
    const holdMs = opts.holdMs ?? 850;
    const hubText = opts.hubText || 'OMNI';
    const resultLabel = opts.resultLabel || 'الفائز';
    const segs = opts.segments.filter(Boolean);
    const n = segs.length;
    if (n < 2 || opts.winnerIndex < 0 || opts.winnerIndex >= n) {
        throw new Error('عجلة الحظ تحتاج قطعتين على الأقل وفائز بينهما');
    }
    const seg = TAU / n;
    const winnerMid = opts.winnerIndex * seg + seg / 2;
    // الاستدارة النهائية تجعل منتصف قطعة الفائز تحت المؤشر (أعلى العجلة)
    let target = POINTER - winnerMid;
    while (target < TAU * 4.5)
        target += TAU;
    const images = await loadImages(segs);
    // لوحة العرض: landscape ← العجلة على اليمين + لوحة مشاركين على اليسار
    const PANEL_W = isLandscape ? Math.round(W * 0.34) : 0; // عرض لوحة المشاركين أصغر لتعظيم العجلة
    const CX = isLandscape ? Math.round(PANEL_W + (W - PANEL_W) / 2) : W / 2;
    const CY = isLandscape ? Math.round(H * 0.5) : Math.round(H * 0.63);
    const R = isLandscape ? Math.round(Math.min(H * 0.42, (W - PANEL_W) * 0.44)) : Math.round(W * 0.335);
    const RIM = isLandscape ? Math.round(Math.max(18, H * 0.036)) : Math.max(14, Math.round(W * 0.036));
    const HUB = Math.round(R * 0.26);
    const SEG_R = R;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    // أدوات مساعدة للرسم
    const rr = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };
    const drawDiamond = (x, y, s) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
    };
    const drawBackground = () => {
        if (isLandscape) {
            // لوحة المشاركين (يسرى) — خلفية داكنة
            ctx.fillStyle = '#0b1224';
            ctx.fillRect(0, 0, PANEL_W, H);
            // حجرة العجلة (يمنى) — داكنة موحّدة
            ctx.fillStyle = '#030712';
            ctx.fillRect(PANEL_W, 0, W - PANEL_W, H);
            // توهج بسيط خلف العجلة (بدون تدرجات مكلفة)
            ctx.fillStyle = 'rgba(245,158,11,0.08)';
            ctx.fillRect(PANEL_W, 0, Math.round((W - PANEL_W) * 0.35), H);
            // دوائر متحدة المركز خلف العجلة
            ctx.strokeStyle = 'rgba(148,163,184,0.06)';
            ctx.lineWidth = 1;
            for (let r = R * 0.55; r < H * 0.75; r += R * 0.36) {
                ctx.beginPath();
                ctx.arc(CX, CY, r, 0, TAU);
                ctx.stroke();
            }
            // زخارف الزوايا الذهبية على اللوحة
            const bracket = Math.round(PANEL_W * 0.062);
            const bracketStroke = (x, y, dx, dy) => {
                ctx.save();
                ctx.strokeStyle = '#d4a017';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x + bracket * dx, y);
                ctx.lineTo(x, y);
                ctx.lineTo(x, y + bracket * dy);
                ctx.stroke();
                ctx.restore();
            };
            bracketStroke(12, 12, 1, 1);
            bracketStroke(PANEL_W - 12, 12, -1, 1);
            bracketStroke(12, H - 12, 1, -1);
            bracketStroke(PANEL_W - 12, H - 12, -1, -1);
            // خط فاصل ذهبي بين اللوحة والعجلة
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(PANEL_W - 1, 0, 2, H);
            return;
        }
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(148,163,184,0.07)';
        ctx.lineWidth = 1;
        for (let r = R * 0.55; r < H; r += R * 0.36) {
            ctx.beginPath();
            ctx.arc(CX, CY, r, 0, TAU);
            ctx.stroke();
        }
    };
    const drawTitle = (glow) => {
        const gold = '#f59e0b';
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isLandscape) {
            const px = PANEL_W / 2;
            // OMNI ROULETTE — شارة ملتصقة بالأعلى
            ctx.font = `bold ${Math.round(W * 0.014)}px ${fontFor('OMNIROULETTE')}`;
            ctx.fillStyle = '#d4a017';
            ctx.fillText('★  O M N I   R O U L E T T E  ★', px, H * 0.078);
            // اسم البطولة — ذهبي
            ctx.fillStyle = '#fcd34d';
            ctx.font = `bold ${Math.round(W * 0.048)}px ${fontFor(opts.title)}`;
            ctx.fillText(opts.title, px, H * 0.175);
            // العنوان الفرعي
            if (opts.subtitle) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = `${Math.round(W * 0.017)}px ${fontFor(opts.subtitle, false)}`;
                ctx.fillText(opts.subtitle, px, H * 0.235);
            }
            // خط فاصل مع ماسة في المنتصف
            const dy = H * 0.278;
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(PANEL_W * 0.17, dy, PANEL_W * 0.66, 2);
            drawDiamond(px, dy + 1, 8);
            // ───── قائمة المشاركين ─────
            const startY = H * 0.33;
            const rowH = Math.min(Math.round(H * 0.062), 56);
            const rowPad = 6;
            const maxRows = Math.max(1, Math.min(n, Math.floor((H * 0.88 - startY) / rowH)));
            for (let i = 0; i < maxRows; i++) {
                const y = startY + i * rowH + rowH / 2;
                const isWinnerRow = glow && i === opts.winnerIndex;
                // خلفية الصف
                ctx.fillStyle = isWinnerRow
                    ? 'rgba(245,158,11,0.22)'
                    : i % 2
                        ? 'rgba(148,163,184,0.06)'
                        : 'rgba(148,163,184,0.12)';
                rr(PANEL_W * 0.05, y - rowH / 2 + rowPad / 2, PANEL_W * 0.9, rowH - rowPad, 10);
                ctx.fill();
                if (isWinnerRow) {
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                }
                // آفاتار — أكبر، بجانب الاسم
                const ar = rowH * 0.38;
                const ax = PANEL_W * 0.14;
                const av = images[i];
                if (av) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(ax, y, ar, 0, TAU);
                    ctx.closePath();
                    ctx.fillStyle = '#0b1224';
                    ctx.fill();
                    ctx.clip();
                    ctx.drawImage(av, ax - ar, y - ar, ar * 2, ar * 2);
                    ctx.restore();
                }
                else {
                    ctx.beginPath();
                    ctx.arc(ax, y, ar, 0, TAU);
                    ctx.fillStyle = '#0b1224';
                    ctx.fill();
                    ctx.textAlign = 'center';
                    ctx.font = `bold ${Math.round(ar * 1.05)}px ${fontFor(String(segs[i]?.label || '?'))}`;
                    ctx.fillStyle = '#f8fafc';
                    ctx.fillText((String(segs[i]?.label || '?').trim().charAt(0) || '?').toUpperCase(), ax, y + 1);
                    ctx.textAlign = 'center';
                }
                ctx.beginPath();
                ctx.arc(ax, y, ar, 0, TAU);
                ctx.lineWidth = isWinnerRow ? 3 : 2;
                ctx.strokeStyle = isWinnerRow ? '#fde047' : '#d4a017';
                ctx.stroke();
                // الاسم — بجانب الصورة وبعرض أكبر
                const name = String(segs[i]?.label || '').slice(0, 20);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.font = `bold ${Math.round(W * 0.019)}px ${fontFor(name)}`;
                ctx.fillStyle = isWinnerRow ? '#fde68a' : '#e2e8f0';
                const nameX = ax + ar + Math.round(PANEL_W * 0.045);
                const rightBound = isWinnerRow ? PANEL_W * 0.66 : PANEL_W * 0.92;
                let drawName = name;
                while (ctx.measureText(drawName).width > rightBound - nameX && drawName.length > 3)
                    drawName = drawName.slice(0, -2) + '…';
                ctx.fillText(drawName, nameX, y);
                if (isWinnerRow) {
                    ctx.textAlign = 'right';
                    ctx.fillStyle = '#fbbf24';
                    ctx.font = `bold ${Math.round(W * 0.019)}px ${fontFor(resultLabel)}`;
                    ctx.fillText(resultLabel, PANEL_W * 0.92, y);
                }
            }
            ctx.restore();
            // تذييل اللوحة — المجموع + الختم
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const shown = Math.min(n, maxRows);
            ctx.fillStyle = '#64748b';
            ctx.font = `${Math.round(W * 0.0135)}px ${fontFor('اللاعبين', false)}`;
            ctx.fillText(shown < n ? `و ${n - shown} لاعبين آخرين — المجموع ${n}` : `المشاركين: ${n}`, px, H * 0.895);
            ctx.fillStyle = '#475569';
            ctx.font = `bold ${Math.round(W * 0.0115)}px OmniSans`;
            ctx.fillText('O M N I', px, H * 0.943);
            ctx.restore();
            return;
        }
        ctx.font = `bold ${Math.round(W * 0.085)}px ${fontFor(opts.title)}`;
        ctx.fillStyle = gold;
        ctx.fillText(opts.title, CX, H * 0.068);
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
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(CX, tipY);
        ctx.lineTo(CX - halfBase, baseY);
        ctx.lineTo(CX + halfBase, baseY);
        ctx.closePath();
        ctx.fillStyle = '#fde047';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#713f12';
        ctx.stroke();
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
    const drawWheel = (rotation, glowWinner) => {
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
            // تدرّج داخلي خفيف مُبسّط (بدون radial gradient)
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, SEG_R, a0, a1);
            ctx.closePath();
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
                ctx.lineWidth = 7;
                ctx.strokeStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(0, 0, SEG_R - 4, a0 + 0.02, a1 - 0.02);
                ctx.stroke();
                ctx.restore();
            }
            const avatar = images[i];
            const avatarR = Math.max(18, Math.min(34, SEG_R * (n <= 4 ? 0.2 : n <= 6 ? 0.17 : 0.145)));
            const groupDist = SEG_R * 0.56;
            const label = String(segs[i].label || '').slice(0, 12);
            // الاسم بالعرض + الصورة بجانبه (مجموعة أفقية ثابتة الاتجاه داخل القطعة)
            ctx.save();
            ctx.rotate(mid);
            ctx.translate(groupDist, 0);
            ctx.rotate(-mid); // إبقاء النص والصورة أفقيين على الشاشة
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const fontSize = Math.max(13, Math.min(22, Math.round(W * (n <= 6 ? 0.018 : 0.015))));
            ctx.font = `bold ${fontSize}px ${fontFor(label)}`;
            let drawLabel = label;
            const maxTextW = SEG_R * (n <= 4 ? 0.38 : n <= 6 ? 0.32 : 0.26);
            while (ctx.measureText(drawLabel).width > maxTextW && drawLabel.length > 2)
                drawLabel = drawLabel.slice(0, -1) + '…';
            const textW = ctx.measureText(drawLabel).width;
            const gap = Math.max(4, avatarR * 0.25);
            const totalW = avatarR * 2 + gap + textW;
            const startX = -totalW / 2;
            const ax = startX + avatarR;
            const ay = 0;
            // إطار/خلفية خفيفة للمجموعة لزيادة الوضوح
            ctx.fillStyle = 'rgba(2,6,23,0.45)';
            rr(startX - 6, -avatarR - 4, totalW + 12, avatarR * 2 + 8, avatarR * 0.6);
            ctx.fill();
            if (avatar) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(ax, ay, avatarR, 0, TAU);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, ax - avatarR, ay - avatarR, avatarR * 2, avatarR * 2);
                ctx.restore();
                ctx.beginPath();
                ctx.arc(ax, ay, avatarR, 0, TAU);
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#fbbf24';
                ctx.stroke();
            }
            else {
                ctx.beginPath();
                ctx.arc(ax, ay, avatarR, 0, TAU);
                ctx.fillStyle = 'rgba(15,23,42,0.9)';
                ctx.fill();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = '#fbbf24';
                ctx.stroke();
                ctx.save();
                ctx.textAlign = 'center';
                ctx.font = `bold ${Math.round(avatarR * 1.05)}px ${fontFor(label)}`;
                ctx.fillStyle = '#ffffff';
                ctx.fillText((label.trim().charAt(0) || '?').toUpperCase(), ax, ay + 1);
                ctx.restore();
            }
            const tx = ax + avatarR + gap;
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = 'rgba(2,6,23,0.95)';
            ctx.strokeText(drawLabel, tx, ay);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(drawLabel, tx, ay);
            ctx.restore();
        }
        // الإطار الذهبي الخارجي (بدون تدرجات مكلفة)
        ctx.beginPath();
        ctx.arc(0, 0, SEG_R + RIM * 0.5, 0, TAU);
        ctx.lineWidth = RIM;
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
        // براغٍ على الإطار (مبسطة)
        const rivetR = SEG_R + RIM * 0.5;
        const rivets = 10;
        for (let i = 0; i < rivets; i++) {
            const a = (i / rivets) * TAU;
            const rx = Math.cos(a) * rivetR;
            const ry = Math.sin(a) * rivetR;
            ctx.beginPath();
            ctx.arc(rx, ry, RIM * 0.22, 0, TAU);
            ctx.fillStyle = '#d4a017';
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
        ctx.fillStyle = '#e11d48';
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
    // إطار ثابت نهائي: هالة ذهبية تضيء حول العجلة + اسم المختار بشكل واضح
    const drawFinalOverlay = () => {
        const winnerName = String(segs[opts.winnerIndex]?.label || '').slice(0, 24);
        ctx.save();
        ctx.beginPath();
        ctx.arc(CX, CY, SEG_R + RIM, 0, TAU);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(255,215,0,0.9)';
        ctx.stroke();
        ctx.restore();
        // لافتة كبيرة وواضحة باسم العضو اللي عليه الدور/الفائز
        const bannerText = `${resultLabel}: ${winnerName}`;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = isLandscape ? Math.round(W * 0.028) : Math.round(W * 0.055);
        ctx.font = `bold ${fontSize}px ${fontFor(bannerText)}`;
        const metrics = ctx.measureText(bannerText);
        const padX = fontSize * 0.9;
        const padY = fontSize * 0.55;
        const bw = Math.min((metrics.width || bannerText.length * fontSize * 0.5) + padX * 2, (isLandscape ? W - PANEL_W : W) - 40);
        const bh = fontSize + padY * 2;
        const bx = CX - bw / 2;
        const byRaw = isLandscape ? H - bh - Math.round(H * 0.045) : CY + R + RIM + Math.round(H * 0.04);
        const by = Math.max(8, Math.min(byRaw, H - bh - 8));
        // خلفية اللافتة (لون ثابت — بدون تدرج مكلف)
        ctx.fillStyle = 'rgba(180,83,9,0.96)';
        rr(bx, by, bw, bh, 14);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#fde68a';
        ctx.stroke();
        // نص اللافتة
        ctx.fillStyle = '#fffbeb';
        // قص النص لو طويل
        let drawText = bannerText;
        while (ctx.measureText(drawText).width > bw - padX * 1.2 && drawText.length > 4) {
            drawText = drawText.slice(0, -2) + '…';
        }
        ctx.fillText(drawText, CX, by + bh / 2 + 1);
        ctx.restore();
    };
    const frameCount = frames + 1; // + إطار ثابت أخير لإبراز الفائز
    const wantPng = opts.format === 'png';
    // مسار سريع لخصر الموارد: صورة ثابتة واحدة (PNG) بدل GIF كامل — مع كاش للجولات المكررة
    let pngKey = null;
    if (wantPng) {
        if (!opts.noCache) {
            pngKey = pngCacheKey(opts);
            const cached = pngCacheGet(pngKey);
            if (cached) {
                logger.info(`🎡 wheel PNG cache hit (${W}x${H})`);
                return cached;
            }
        }
        const rotation = target; // استقر على الفائز
        drawBackground();
        drawTitle(true);
        drawWheel(rotation, true);
        drawPointer();
        drawFinalOverlay();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const png = ctx.canvas.toBuffer('image/png');
        if (pngKey)
            pngCacheSet(pngKey, png);
        logger.info(`🎡 wheel PNG rendered (${W}x${H})`);
        return png;
    }
    // مسار GIF فقط: عينة إطار واحد لاختيار لوحة الألوان
    const sampleRotation = easeOutQuart(0.4) * target;
    drawBackground();
    drawTitle(false);
    drawWheel(sampleRotation, false);
    drawPointer();
    const { data: sampleData } = ctx.getImageData(0, 0, W, H);
    // ترميز GIF (مضمّن مع البوت — لا يعتمد على node_modules في الاستضافة)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let gifenc;
    try {
        gifenc = require('./vendor/gifenc');
    }
    catch {
        gifenc = require('gifenc');
    }
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const palette = quantize(sampleData, 224);
    const gif = GIFEncoder();
    for (let i = 0; i < frameCount; i++) {
        const isFinal = i === frameCount - 1;
        const t = isFinal ? 1 : i / (frames - 1);
        const rotation = easeOutQuart(t) * target;
        const glow = isFinal || t > 0.93;
        drawBackground();
        drawTitle(glow);
        drawWheel(rotation, glow);
        drawPointer();
        if (isFinal)
            drawFinalOverlay();
        const { data } = ctx.getImageData(0, 0, W, H);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, W, H, { palette, delay: isFinal ? holdMs : delayMs, transparent: false });
        // إعطاء مجال لـ event loop بين الإطارات لتقليل تجميد البوت
        if (!isFinal && i % 2 === 1) {
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
    gif.finish();
    const out = Buffer.from(gif.bytes());
    logger.info(`🎡 wheel GIF rendered: ${out.length} bytes in ${frameCount} frames (${W}x${H})`);
    return out;
}
/** تحميل آفاتار ديسكورد كـ Buffer (null عند الفشل — لا تُرمي) — مع كاش LRU وكاش للفترة المتزامنة */
const AVATAR_CACHE_MAX = 64;
const avatarCache = new Map();
async function fetchAvatarBuffer(url) {
    const key = String(url || '').slice(0, 512);
    if (!key)
        return null;
    const cached = avatarCache.get(key);
    if (cached) {
        avatarCache.delete(key);
        avatarCache.set(key, cached);
        return cached;
    }
    const promise = (async () => {
        try {
            const axios = require('axios');
            const res = await axios.get(key, {
                responseType: 'arraybuffer',
                timeout: 4000,
                maxContentLength: 4 * 1024 * 1024,
                maxBodyLength: 4 * 1024 * 1024,
            });
            const buf = Buffer.from(res.data);
            return buf.length ? buf : null;
        }
        catch {
            return null;
        }
    })();
    avatarCache.set(key, promise);
    while (avatarCache.size > AVATAR_CACHE_MAX) {
        const firstKey = avatarCache.keys().next().value;
        if (firstKey === undefined)
            break;
        avatarCache.delete(firstKey);
    }
    return promise;
}
//# sourceMappingURL=wheelOfFortune.js.map