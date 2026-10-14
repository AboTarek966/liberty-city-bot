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
exports.translateForImage = translateForImage;
exports.detectImagePrompt = detectImagePrompt;
exports.generatePollinationsImage = generatePollinationsImage;
exports.generateImageWithRetry = generateImageWithRetry;
const axios_1 = __importDefault(require("axios"));
const helpers_1 = require("./helpers");
const config_1 = require("../config");
const logger = (0, helpers_1.createLogger)('ImageGen');
// --------------------------------------------
// الترجمة: موديل الرسم (flux) لا يفهم العربية إطلاقاً
//   تجربة مثبتة بالدليل: "كلب على شط البحر" → رسم وجه فتاة!
//   لذلك نُترجم الوصف إلى الإنجليزي أولاً (Groq — مجاني، < 1 ثانية)
// --------------------------------------------
const ARABIC_RE = /[\u0600-\u06FF]/;
/**
 * موديلات الترجمة بالترتيب — الأول عربي أصلي وسريع (غير استدلالي).
 * ⚠️ لا نستخدم موديلات استدلالية بحدّ رموز صغير: التفكير يستهلك الرموز
 *    ويعيد محتوىً فارغاً (هذا سبب فشل النسخة الأولى فعلياً).
 */
const TRANSLATE_MODELS = ['allam-2-7b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];
/**
 * يُترجم الوصف العربي إلى إنجليزي قبل إرساله لموديل الرسم.
 * يعيد النص الأصلي إذا لم يكن عربياً أو فشلت الترجمة (لا نكسر الميزة).
 * زمن مقاس: ~300-900ms.
 */
async function translateForImage(text) {
    const trimmed = (text || '').trim();
    if (trimmed.length < 3 || !ARABIC_RE.test(trimmed))
        return trimmed;
    const apiKey = config_1.config.ai.groq.apiKey;
    if (!apiKey)
        return trimmed;
    const SYSTEM = 'You convert a user request into a vivid English image-generation prompt. ' +
        'Keep every detail (subject, action, place, colours, style). ' +
        'Reply with ONLY the English prompt — no quotes, no explanation, max 80 words.';
    for (const model of TRANSLATE_MODELS) {
        try {
            const res = await axios_1.default.post('https://api.groq.com/openai/v1/chat/completions', {
                model,
                messages: [
                    { role: 'system', content: SYSTEM },
                    { role: 'user', content: trimmed },
                ],
                temperature: 0.3,
                max_tokens: 600,
            }, 
            // ⚠️ بدون هذه الترويسة يرجع Groq 401 وتسكت الترجمة بصمت
            { timeout: 8_000, headers: { Authorization: `Bearer ${apiKey}` } });
            const out = res.data?.choices?.[0]?.message?.content;
            const clean = (out || '').replace(/^["'`]+|["'`]+$/g, '').trim();
            // نرفض الناتج إذا بقي عربياً أو كان فارغاً/قصيرأً ثم نجرب الموديل التالي
            if (clean.length >= 3 && !ARABIC_RE.test(clean)) {
                logger.info(`Prompt translated [${model}]: "${trimmed.slice(0, 40)}" -> "${clean.slice(0, 60)}"`);
                return clean;
            }
            logger.warn(`Model ${model} returned empty/non-English output — trying next`);
        }
        catch (err) {
            logger.warn(`Translation model ${model} failed: ${err?.message || err}`);
        }
    }
    logger.warn('All translation models failed — using original prompt');
    return trimmed;
}
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
    // إنجليزي: generate/create/make an image of ...
    /^\s*(?:please\s+)?(?:generate|create|make|draw|render|paint|design|illustrate)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|drawing|illustration|art|wallpaper|logo|avatar)\s*(?:of|for|:|with)?\s*(.{3,})$/is,
    // إنجليزي بدون كلمة "image": "draw me a dog on the beach"
    //   أفعال الرسم فقط (draw/paint/illustrate) — لا نضمّن make/create لأنها عامة جداً
    /^\s*(?:please\s+)?(?:draw|paint|illustrate)\s+(?:me\s+)?(?:an?\s+|the\s+)?(.{3,})$/is,
    /^\s*(?:image|picture|photo)\s+(?:of|:|with)\s+(.{3,})$/is,
];
/** صياغة جودة تُلحق بالإنجليزي — ترفع دقّة النتيجة بغضّ النظر عن لغة الوصف */
const QUALITY_SUFFIX = ', highly detailed, sharp focus, professional lighting, 4k';
/** أسماء الموسيقى — تمنع كاشف الصور من اعتراض طلبات الأغاني (حاجز) */
const MUSIC_NOUN_RE = /(أغني[هة]|اغني[هة]|لحن|موسيق[اة]|موسيقه|مزيكا|نغم[هة]|نغمه|انشوده|أنشوده|\bsong\b|\bmusic\b|\bmelody\b|\btune\b|\binstrumental\b)/i;
/** أسماء الصور — وجودها يُلغي حاجز الموسيقى ("ارسملي صورة حفلة موسيقية" طلب رسم صحيح) */
const IMAGE_NOUN_RE = /(صورة|صوره|رسمة|رسمه|تصميم|لوحه|\bimage\b|\bpicture\b|\bphoto\b|\bdrawing\b|\billustration\b)/i;
/**
 * يكشف هل طلب المستخدم توليد صورة، ويعيد الوصف النظيف.
 * يعيد `null` إذا لم يكن طلب صورة.
 */
function detectImagePrompt(text) {
    const raw = (text || '').trim();
    if (raw.length < 4)
        return null;
    // ⚠️ حاجز الموسيقى: "صمملي أغنية" / "ارسملي لحن" ليست طلبات رسم.
    //   كاشف الموسيقى لا يلتقطها (لأن "صمملي" ليست فعل موسيقي)، فلولا هذا الحاجز
    //   لكانت الصورة تُرسم بوصف غير قابل للرسم إطلاقاً.
    //   الشرط: يحتوي اسم موسيقى ولا يحتوي اسم صورة ("ارسملي صورة حفلة موسيقية" مقبول).
    if (MUSIC_NOUN_RE.test(raw) && !IMAGE_NOUN_RE.test(raw)) {
        logger.info(`Image request rejected (looks like music): "${raw.slice(0, 60)}"`);
        return null;
    }
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
async function generateImageWithRetry(prompt, opts = {}, attempts = 4) {
    for (let i = 1; i <= attempts; i++) {
        try {
            const img = await generatePollinationsImage(prompt, opts);
            if (img && img.data.length > 2048)
                return img;
            logger.warn(`Image attempt ${i}/${attempts}: empty/invalid image`);
        }
        catch (err) {
            const status = err?.response?.status;
            // 402/429 = حدّد المجاني مؤقت — ننتظر أطول قبل إعادة المحاولة
            const rateLimited = status === 402 || status === 429;
            logger.warn(`Image attempt ${i}/${attempts} failed${status ? ` (HTTP ${status})` : ''}: ${err?.message || err}`);
            if (rateLimited && i < attempts) {
                await new Promise((r) => setTimeout(r, 5_000 * i));
                continue;
            }
        }
        if (i < attempts)
            await new Promise((r) => setTimeout(r, 1_500 * i));
    }
    return null;
}
//# sourceMappingURL=imageGen.js.map