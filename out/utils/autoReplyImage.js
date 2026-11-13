"use strict";
// ============================================
// Omni Bot - Auto Reply Image
// تحميل صورة من الجهاز/الرابط وضغطها وتجهيزها للتخزين
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_REPLY_IMAGE_MAX_STORED = exports.AUTO_REPLY_IMAGE_MAX_INPUT = void 0;
exports.extensionForMime = extensionForMime;
exports.autoReplyAttachmentName = autoReplyAttachmentName;
exports.getAutoReplyImageBuffer = getAutoReplyImageBuffer;
exports.downloadAutoReplyAttachment = downloadAutoReplyAttachment;
exports.prepareAutoReplyImage = prepareAutoReplyImage;
const axios_1 = __importDefault(require("axios"));
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('AutoReplyImage');
/** أقصى حجم للملف الأصلي قبل الضغط */
exports.AUTO_REPLY_IMAGE_MAX_INPUT = 12 * 1024 * 1024; // 12MB
/** أقصى حجم للصورة بعد الضغط — base64 يزيد الحجم ~33% لكنه يبقى ضمن حدود Mongo */
exports.AUTO_REPLY_IMAGE_MAX_STORED = 1_500_000; // 1.5MB
/** أقصى أبعاد بعد الضغط */
const MAX_DIMENSION = 1280;
const MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};
function cleanMime(raw) {
    return String(raw || '').toLowerCase().split(';')[0].trim();
}
function inferMime(name) {
    const ext = String(name || '').toLowerCase().split('.').pop() || '';
    if (ext === 'jpg' || ext === 'jpeg')
        return 'image/jpeg';
    if (ext === 'png')
        return 'image/png';
    if (ext === 'webp')
        return 'image/webp';
    if (ext === 'gif')
        return 'image/gif';
    return '';
}
function extensionForMime(mime) {
    return MIME_EXT[cleanMime(mime)] || 'jpg';
}
/** اسم مرفق ثابت وآمن لاستخدامه في attachment:// */
function autoReplyAttachmentName(mime) {
    return `auto-reply.${extensionForMime(mime)}`;
}
/** فك base64 المحفوظ مع حدود أمان */
function getAutoReplyImageBuffer(cfg) {
    const raw = String(cfg?.imageData || '').trim();
    if (!raw)
        return null;
    try {
        const buf = Buffer.from(raw, 'base64');
        if (!buf.length)
            return null;
        if (buf.length > exports.AUTO_REPLY_IMAGE_MAX_STORED + 512 * 1024)
            return null;
        return buf;
    }
    catch {
        return null;
    }
}
/** تنزيل مرفق ديسكورد مع حد أقصى للحجم */
async function downloadAutoReplyAttachment(url) {
    const res = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: 20_000,
        maxContentLength: exports.AUTO_REPLY_IMAGE_MAX_INPUT,
        maxBodyLength: exports.AUTO_REPLY_IMAGE_MAX_INPUT,
        headers: { 'User-Agent': 'OmniBot/2.0' },
    });
    return Buffer.from(res.data);
}
/**
 * ضغط الصورة وتجهيزها للتخزين.
 * الصور الصغيرة تبقى بصيغتها، والكبيرة تُحوّل JPEG بأبعاد مناسبة.
 */
async function prepareAutoReplyImage(buffer, mimeType, originalName = '') {
    if (!buffer.length)
        throw new Error('الصورة فارغة');
    if (buffer.length > exports.AUTO_REPLY_IMAGE_MAX_INPUT) {
        throw new Error('حجم الصورة كبير جداً — الحد الأقصى 12MB');
    }
    const mime = cleanMime(mimeType) || inferMime(originalName);
    if (!mime.startsWith('image/'))
        throw new Error('الملف المرفق ليس صورة');
    const displayName = String(originalName || 'auto-reply').slice(0, 180);
    // 🎞️ احتفظ بـ GIF الصغير كما هو حتى لا تفقد الحركة
    if (mime === 'image/gif' && buffer.length <= exports.AUTO_REPLY_IMAGE_MAX_STORED) {
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
        let maxDim = MAX_DIMENSION;
        let quality = 0.85;
        let lastSize = buffer.length;
        // جرّب جودة/أبعاد أقل تدريجياً حتى يدخل تحت الحد
        for (let attempt = 0; attempt < 10; attempt++) {
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = createCanvas(w, h);
            const ctx = canvas.getContext('2d');
            // خلفية بيضاء للصور الشفافة قبل تحويلها JPEG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const out = canvas.toBuffer('image/jpeg', quality);
            lastSize = out.length;
            if (out.length <= exports.AUTO_REPLY_IMAGE_MAX_STORED) {
                logger.info(`Auto-reply image compressed: ${buffer.length} → ${out.length} bytes (${w}x${h})`);
                return {
                    base64: out.toString('base64'),
                    mimeType: 'image/jpeg',
                    name: displayName.replace(/\.[^.]+$/, '') + '.jpg',
                    bytes: out.length,
                    width: w,
                    height: h,
                };
            }
            if (quality > 0.6)
                quality = Math.max(0.6, quality - 0.1);
            else
                maxDim = Math.max(640, Math.floor(maxDim * 0.75));
        }
        throw new Error(`تعذّر ضغط الصورة لحجم مناسب (آخر حجم: ${lastSize} بايت)`);
    }
    catch (err) {
        // لو الصورة أصلها صغيرة ومدعومة، احفظها كما هي بدل الفشل
        if (buffer.length <= exports.AUTO_REPLY_IMAGE_MAX_STORED && MIME_EXT[mime]) {
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
//# sourceMappingURL=autoReplyImage.js.map