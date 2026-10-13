"use strict";
// ============================================
// Liberty City Bot - مولّد الصور بالذكاء الاصطناعي
//
// مجاني بالكامل: Pollinations.ai
//   - بلا مفتاح API
//   - بلا بطاقة ائتمان
//   - بلا حساب
// (موديلات توليد الصور عند Gemini كلها limit:0 في الـFree Tier — لذلك نستخدم Pollinations)
//
// سرعة فعلية مقاسة: ~6-12 ثانية للصورة 1024×1024
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectImagePrompt = detectImagePrompt;
exports.generatePollinationsImage = generatePollinationsImage;
exports.generateImageWithRetry = generateImageWithRetry;
const axios_1 = __importDefault(require("axios"));
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('ImageGen');
const BASE = 'https://image.pollinations.ai/prompt/';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — سقف ديسكورد للمرفقات القديمة
const TIMEOUT_MS = 90_000; // بعض الطلبات تأخذ حتى دقيقة على المجاني
/**
 * كلمات تشغيل توليد الصور (عربي + إنجليزي).
 * تُرتَّب من الأدق إلى الأقل تحديداً حتى لا يخطف طلب عادي مثل "وش صورة الرسالة؟".
 */
const TRIGGERS = [
    // ارسملي / ارسم لي / ارسم ... / صمملي ...
    /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز|please|pls)?\s*(?:ارسملي|ارسم\s*لي|ارسملنا|ارسم\s*لنا|ارسم|صمملي|صمم\s*لي|صمم|ارسمها)\s*(?:[:\-–،,]\s*)?(.{3,})$/is,
    // اعمل/سوي/طلّع/انشئ + (لي) + صورة/رسمة/تصميم + وصف
    /^\s*(?:من\s*فضلك|لو\s*سمحت|بليز)?\s*(?:اعمل|عمل|سوي|سوّي|طلّع|طلع|انشئ|اجهز)\s*(?:لي\s*)?(?:صورة|صوره|رسمة|رسمه|تصميم|لوحه)\s*(?:[:\-–،,]\s*|لـ|لف|عن\s*)?(.{3,})$/is,
    // "أبغى صورة ..." / "ابي صورة ..."
    /^\s*(?:ابغى|ابي|أبغى|أبي|ابي|بدي)\s+(?:اشوف\s+|انشئ\s+|انشيلي\s+)?(?:صورة|صوره)\s*(?:[:\-–،,]\s*|لـ|لف|عن\s*)?(.{3,})$/is,
    // "صورة قطة" / "رسمة مدينة" — وصف مباشر بعد الاسم
    /^\s*(?:صورة|صوره|رسمة|رسمه|لوحه)\s+(?:لـ|لف|عن\s*)?(.{3,})$/is,
    // إنجليزي: generate/create/make/draw an image of ...
    /^\s*(?:please\s+)?(?:generate|create|make|draw|render|paint|design|illustrate)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|drawing|illustration|art|wallpaper|logo|avatar)\s*(?:of|for|:|with)?\s*(.{3,})$/is,
    /^\s*(?:image|picture|photo)\s+(?:of|:|with)\s+(.{3,})$/is,
];
/** صياغة جودة تُلحق بالإنجليزي — ترفع دقّة النتيجة بغضّ النظر عن لغة الوصف */
const QUALITY_SUFFIX = ', highly detailed, sharp focus, professional lighting, 4k';
/**
 * يكشف هل طلب المستخدم توليد صورة، ويعيد الوصف النظيف.
 * يعيد `null` إذا لم يكن طلب صورة.
 */
function detectImagePrompt(text) {
    const raw = (text || '').trim();
    if (raw.length < 4)
        return null;
    for (const re of TRIGGERS) {
        const m = raw.match(re);
        if (!m)
            continue;
        const prompt = (m[1] || '').replace(/["“”'‘’]/g, '').replace(/\s+/g, ' ').trim();
        if (prompt.length >= 3)
            return prompt.slice(0, 400);
    }
    return null;
}
/** يولّد صورة واحدة عبر Pollinations.ai */
async function generatePollinationsImage(prompt, opts = {}) {
    const width = opts.width ?? 1024;
    const height = opts.height ?? 1024;
    const model = opts.model ?? 'flux';
    const seed = Math.floor(Math.random() * 1_000_000);
    const full = `${prompt}${QUALITY_SUFFIX}`;
    const url = `${BASE}${encodeURIComponent(full)}` +
        `?width=${width}&height=${height}&nologo=true&model=${model}&seed=${seed}`;
    const t0 = Date.now();
    const res = await axios_1.default.get(url, {
        responseType: 'arraybuffer',
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'Mozilla/5.0 (LibertyCityBot)' },
        maxContentLength: MAX_BYTES,
        validateStatus: (s) => s === 200,
    });
    const data = Buffer.from(res.data);
    if (!data.length)
        return null;
    const mimeType = String(res.headers['content-type'] || 'image/jpeg').split(';')[0];
    logger.info(`Image generated in ${Date.now() - t0}ms (${(data.length / 1024).toFixed(0)}KB, ${mimeType})`);
    return {
        data,
        mimeType,
        ext: /png/i.test(mimeType) ? 'png' : /webp/i.test(mimeType) ? 'webp' : 'jpg',
    };
}
/**
 * يولّد صورة مع إعادة المحاولة — المجاني أحياناً يتأخر أو يرجع خطأ مؤقت.
 * المهلة تتزايد تدريجياً (1.2s ثم 2.4s) حتى لا نغرق الخدمة.
 */
async function generateImageWithRetry(prompt, opts = {}, attempts = 3) {
    for (let i = 1; i <= attempts; i++) {
        try {
            const img = await generatePollinationsImage(prompt, opts);
            // نعتبر الصورة صالحة فقط إذا تجاوزت 2KB (أحياناً يرجع خادم خطأ بصيغة صورة فارغة)
            if (img && img.data.length > 2048)
                return img;
        }
        catch (err) {
            logger.warn(`Image attempt ${i}/${attempts} failed: ${err?.message || err}`);
        }
        if (i < attempts)
            await new Promise((r) => setTimeout(r, 1200 * i));
    }
    return null;
}
//# sourceMappingURL=imageGen.js.map