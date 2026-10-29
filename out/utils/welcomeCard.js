"use strict";
// ============================================
// Liberty City Bot - بطاقة الترحيب المرسومة (مثل ProBot)
// رسم على صورة خلفية: صورة العضو + اسمه + رقم عضويته
// مساحة الرسم 800×300 — النص يصغر تلقائياً ولا يُقص أبداً
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARD_DEFAULTS = exports.CARD_HEIGHT = exports.CARD_WIDTH = void 0;
exports.sanitizeCardText = sanitizeCardText;
exports.renderWelcomeCard = renderWelcomeCard;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const canvas_1 = require("@napi-rs/canvas");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('WelcomeCard');
exports.CARD_WIDTH = 800;
exports.CARD_HEIGHT = 300;
/** القيم الافتراضية (تخطيط جاهز — يمكن تعديله في المحرر) */
exports.CARD_DEFAULTS = {
    enabled: true,
    backgroundUrl: undefined,
    backgroundFit: 'cover',
    backgroundX: 0,
    backgroundY: 0,
    backgroundScale: 1,
    backgroundRotation: 0,
    backgroundOpacity: 1,
    avatarX: 130,
    avatarY: 150,
    avatarSize: 170,
    avatarRotation: 0,
    avatarBorderWidth: 5,
    avatarBorderColor: '#FFFFFF',
    avatarShadow: true,
    avatarShadowColor: 'rgba(0,0,0,0.5)',
    avatarShadowBlur: 10,
    avatarShadowOffsetX: 0,
    avatarShadowOffsetY: 4,
    nameX: 350,
    nameY: 130,
    nameSize: 52,
    nameColor: '#FFFFFF',
    nameFont: 'Tajawal-Bold',
    nameRotation: 0,
    nameShadow: true,
    nameShadowColor: 'rgba(0,0,0,0.55)',
    nameShadowBlur: 6,
    nameShadowOffsetX: 0,
    nameShadowOffsetY: 2,
    countX: 350,
    countY: 195,
    countSize: 28,
    countColor: '#C7CED8',
    countFont: 'Tajawal',
    countRotation: 0,
    countShadow: false,
    // نصوص مخصصة — مصفوفة عناصر لا محدودة
    customTexts: [],
};
let fontsRegistered = false;
/** تسجيل الخطوط العربية المرفقة (مرة واحدة) */
function ensureFonts() {
    if (fontsRegistered)
        return;
    fontsRegistered = true;
    try {
        const dir = path_1.default.join(__dirname, '..', '..', 'assets', 'fonts');
        if (!fs_1.default.existsSync(dir)) {
            logger.warn(`fonts dir not found: ${dir} — names may not render in Arabic`);
            return;
        }
        for (const file of fs_1.default.readdirSync(dir)) {
            if (!/\.ttf$/i.test(file))
                continue;
            const family = file.replace(/\.ttf$/i, '').replace(/-(Regular|Bold|Medium)$/i, '');
            const ok = canvas_1.GlobalFonts.registerFromPath(path_1.default.join(dir, file), family);
            if (ok)
                logger.debug(`Registered font: ${file} → ${family}`);
        }
    }
    catch (error) {
        logger.warn('Font registration failed:', error);
    }
}
// --------------------------------------------
// كاش مؤقت للصور (سرعة في المحرر — كل ضغطة سهم تعيد الرسم)
// --------------------------------------------
const imgCache = new Map();
const IMG_TTL = 10 * 60 * 1000; // 10 دقائق
/** جلب صورة من رابط خارجي مع مهلة وكاش (ولو فشل نكمل برسم متدرّج) */
async function fetchImage(url) {
    const hit = imgCache.get(url);
    if (hit && Date.now() - hit.ts < IMG_TTL)
        return hit.buf;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok)
            return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 0) {
            imgCache.set(url, { buf, ts: Date.now() });
            return buf;
        }
        return null;
    }
    catch {
        return null;
    }
}
/** رسم صورة داخل مستطيل بطريقة "cover" (تغطية بدون تشويه) */
function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
/**
 * إزالة الرموز التي لا يدعمها خط Tajawal (تظهر مربعات □ في الرسم)
 * — رموز تعبيرية وزخرفية وأنظمة كتابة نادرة
 */
function sanitizeCardText(text) {
    return (text || '')
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{A900}-\u{A9DF}\u{0F00}-\u{0FFF}\u{2460}-\u{24FF}\u{2500}-\u{25FF}\u{2E00}-\u{2E7F}\u{E0000}-\u{E01EF}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * تصغير الخط تدريجياً حتى يناسب العرض المتاح — لا يُقص النص أبداً
 * (يُرجع الحجم النهائي والنص النهائي مع … عند الضرورة)
 */
function fitText(ctx, text, maxWidth, startSize, family, minSize = 16) {
    let size = Math.max(minSize, Math.round(startSize));
    let out = text;
    ctx.font = `${size}px ${family}`;
    while (size > minSize && ctx.measureText(out).width > maxWidth) {
        size -= 2;
        ctx.font = `${size}px ${family}`;
    }
    if (ctx.measureText(out).width > maxWidth) {
        while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
            out = out.slice(0, -1);
        }
        out = `${out}…`;
    }
    return { size, text: out };
}
/**
 * رسم بطاقة الترحيب وإرجاعها كصورة PNG
 * (المعاينة في المحرر = الصورة نفسها تماماً التي يراها العضو)
 * يدعم: خلفيات محولة، صورة شخصية متطورة، نصوص بظلال وتدوير، نصوص مخصصة بلا حدود
 */
async function renderWelcomeCard(member, card) {
    ensureFonts();
    const cfg = { ...exports.CARD_DEFAULTS, ...(card || {}) };
    const canvas = (0, canvas_1.createCanvas)(exports.CARD_WIDTH, exports.CARD_HEIGHT);
    const ctx = canvas.getContext('2d');
    const guildName = sanitizeCardText(member.guild.name) || 'سيرفر';
    const displayName = sanitizeCardText(member.displayName || member.user.username) || 'عضو';
    const count = member.guild.memberCount;
    const date = new Date().toLocaleDateString('ar-SA');
    // دالة مساعدة: استبدال المتغيرات في النص
    const replaceVars = (text) => {
        return text
            .replace(/{user}/g, displayName)
            .replace(/{server}/g, guildName)
            .replace(/{count}/g, String(count))
            .replace(/{date}/g, date)
            .replace(/{mention}/g, `<@${member.id}>`);
    };
    // ---------- 1) الخلفية: متدرّج افتراضي + صورة مع تحويلات كاملة ----------
    const gradient = ctx.createLinearGradient(0, 0, exports.CARD_WIDTH, exports.CARD_HEIGHT);
    gradient.addColorStop(0, '#16213e');
    gradient.addColorStop(0.5, '#0f3460');
    gradient.addColorStop(1, '#533483');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, exports.CARD_WIDTH, exports.CARD_HEIGHT);
    if (cfg.backgroundUrl) {
        const buf = await fetchImage(cfg.backgroundUrl);
        if (buf) {
            try {
                const img = await (0, canvas_1.loadImage)(buf);
                ctx.save();
                // تطبيق تحويلات الخلفية: نقل، تكبير، تدوير
                ctx.translate(cfg.backgroundX, cfg.backgroundY);
                ctx.rotate((cfg.backgroundRotation || 0) * Math.PI / 180);
                ctx.scale(cfg.backgroundScale || 1, cfg.backgroundScale || 1);
                ctx.globalAlpha = cfg.backgroundOpacity ?? 1;
                // رسم حسب وضع fit
                const fit = cfg.backgroundFit || 'cover';
                if (fit === 'cover') {
                    drawCover(ctx, img, -exports.CARD_WIDTH / 2, -exports.CARD_HEIGHT / 2, exports.CARD_WIDTH, exports.CARD_HEIGHT);
                }
                else if (fit === 'contain') {
                    const scale = Math.min(exports.CARD_WIDTH / img.width, exports.CARD_HEIGHT / img.height);
                    const dw = img.width * scale;
                    const dh = img.height * scale;
                    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
                }
                else { // stretch
                    ctx.drawImage(img, -exports.CARD_WIDTH / 2, -exports.CARD_HEIGHT / 2, exports.CARD_WIDTH, exports.CARD_HEIGHT);
                }
                ctx.restore();
                // طبقة تعتيم خفيفة لوضوح النص (اختيارية)
                if ((cfg.backgroundOpacity ?? 1) > 0.3) {
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(0, 0, exports.CARD_WIDTH, exports.CARD_HEIGHT);
                }
            }
            catch {
                logger.warn('Background image could not be decoded — using gradient');
            }
        }
        else {
            logger.warn('Background image failed to load — using gradient');
        }
    }
    // ---------- 2) الصورة الشخصية (متطورة: تدوير، ظل، حدود مخصصة) ----------
    const ax = cfg.avatarX;
    const ay = cfg.avatarY;
    const avatarR = Math.max(10, cfg.avatarSize / 2);
    const bw = cfg.avatarBorderWidth || 5;
    const bc = cfg.avatarBorderColor || '#FFFFFF';
    try {
        const avatarBuf = await fetchImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
        if (avatarBuf) {
            const avatarImg = await (0, canvas_1.loadImage)(avatarBuf);
            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate((cfg.avatarRotation || 0) * Math.PI / 180);
            // ظل الصورة
            if (cfg.avatarShadow) {
                ctx.shadowColor = cfg.avatarShadowColor || 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = cfg.avatarShadowBlur || 10;
                ctx.shadowOffsetX = cfg.avatarShadowOffsetX || 0;
                ctx.shadowOffsetY = cfg.avatarShadowOffsetY || 4;
            }
            // قطع دائري
            ctx.beginPath();
            ctx.arc(0, 0, avatarR, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImg, -avatarR, -avatarR, avatarR * 2, avatarR * 2);
            ctx.restore();
            // إطار الصورة (بلا تدوير)
            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate((cfg.avatarRotation || 0) * Math.PI / 180);
            ctx.beginPath();
            ctx.arc(0, 0, avatarR + bw / 2, 0, Math.PI * 2);
            ctx.lineWidth = bw;
            ctx.strokeStyle = bc;
            ctx.stroke();
            ctx.restore();
        }
        else {
            throw new Error('avatar fetch failed');
        }
    }
    catch {
        // بديل: دائرة شبه شفافة مع إطار
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate((cfg.avatarRotation || 0) * Math.PI / 180);
        ctx.beginPath();
        ctx.arc(0, 0, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, avatarR + bw / 2, 0, Math.PI * 2);
        ctx.lineWidth = bw;
        ctx.strokeStyle = bc;
        ctx.stroke();
        ctx.restore();
    }
    // ---------- 3) اسم العضو (مع تدوير، ظل، تصغير تلقائي) ----------
    const nameText = sanitizeCardText(displayName);
    const nameMaxW = Math.max(120, 2 * Math.min(cfg.nameX - 12, exports.CARD_WIDTH - cfg.nameX - 12));
    const nameFamily = cfg.nameFont || 'Tajawal-Bold';
    ctx.save();
    ctx.translate(cfg.nameX, cfg.nameY);
    ctx.rotate((cfg.nameRotation || 0) * Math.PI / 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // ظل الاسم
    if (cfg.nameShadow) {
        ctx.shadowColor = cfg.nameShadowColor || 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = cfg.nameShadowBlur || 6;
        ctx.shadowOffsetX = cfg.nameShadowOffsetX || 0;
        ctx.shadowOffsetY = cfg.nameShadowOffsetY || 2;
    }
    const fittedName = fitText(ctx, nameText, nameMaxW, cfg.nameSize, nameFamily);
    ctx.font = `${fittedName.size}px ${nameFamily}`;
    ctx.fillStyle = cfg.nameColor || '#FFFFFF';
    ctx.fillText(fittedName.text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
    // ---------- 4) رقم العضوية (مع تدوير، ظل) ----------
    const countText = sanitizeCardText(`عضو رقم #${count} • ${guildName}`);
    const countMaxW = Math.max(120, 2 * Math.min(cfg.countX - 12, exports.CARD_WIDTH - cfg.countX - 12));
    const countFamily = cfg.countFont || 'Tajawal';
    ctx.save();
    ctx.translate(cfg.countX, cfg.countY);
    ctx.rotate((cfg.countRotation || 0) * Math.PI / 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (cfg.countShadow) {
        ctx.shadowColor = cfg.nameShadowColor || 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = cfg.nameShadowBlur || 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
    }
    const fittedCount = fitText(ctx, countText, countMaxW, cfg.countSize, countFamily, 12);
    ctx.font = `${fittedCount.size}px ${countFamily}`;
    ctx.fillStyle = cfg.countColor || '#C7CED8';
    ctx.fillText(fittedCount.text, 0, 0);
    ctx.restore();
    // ---------- 5) نصوص مخصصة (لا حدود — كل عنصر بكل خصائصه) ----------
    if (cfg.customTexts?.length) {
        for (const ct of cfg.customTexts) {
            const text = replaceVars(sanitizeCardText(ct.text));
            if (!text)
                continue;
            const maxW = ct.maxWidth || Math.min(ct.x * 2, (exports.CARD_WIDTH - ct.x) * 2, exports.CARD_WIDTH - 40);
            const family = ct.font || 'Tajawal';
            ctx.save();
            ctx.translate(ct.x, ct.y);
            ctx.rotate((ct.rotation || 0) * Math.PI / 180);
            ctx.textAlign = ct.align || 'center';
            ctx.textBaseline = 'middle';
            if (ct.shadow) {
                ctx.shadowColor = ct.shadowColor || 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = ct.shadowBlur || 4;
                ctx.shadowOffsetX = ct.shadowOffsetX || 0;
                ctx.shadowOffsetY = ct.shadowOffsetY || 2;
            }
            const fitted = fitText(ctx, text, maxW, ct.size, family, 12);
            ctx.font = `${fitted.size}px ${family}`;
            ctx.fillStyle = ct.color || '#FFFFFF';
            let drawX = 0;
            if (ct.align === 'left')
                drawX = -maxW / 2;
            else if (ct.align === 'right')
                drawX = maxW / 2;
            ctx.fillText(fitted.text, drawX, 0);
            ctx.restore();
        }
    }
    return canvas.toBuffer('image/png');
}
//# sourceMappingURL=welcomeCard.js.map