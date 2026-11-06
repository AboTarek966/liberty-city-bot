"use strict";
// ============================================
// Omni Bot - Channel Mood Analysis
// ============================================
// تحليل محلي سريع لمشاعر رسائل القناة (بدون AI) + تجهيز النص للتحليل الذكي.
// لا يُخزَّن أي محتوى — التحليل يحدث في الذاكرة فقط.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeArabicText = normalizeArabicText;
exports.analyzeMoodLocally = analyzeMoodLocally;
exports.buildMoodTranscript = buildMoodTranscript;
exports.parseMoodAI = parseMoodAI;
exports.moodLabelArabic = moodLabelArabic;
exports.moodColor = moodColor;
const aiJson_1 = require("./aiJson");
// --------------------------------------------
// Normalization
// --------------------------------------------
function normalizeArabicText(input) {
    return String(input || '')
        .toLowerCase()
        .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ')
        .trim();
}
const POSITIVE_WORDS = [
    'حب', 'حلو', 'جميل', 'رائع', 'ممتاز', 'شكرا', 'شكراً', 'تسلم', 'يسلمو',
    'تمام', 'مبسوط', 'سعيد', 'فرحان', 'فخور', 'نجاح', 'مبروك', 'أفضل', 'افضل',
    'حماس', 'مفيد', 'عظيم', 'يستاهل', 'تحفة', 'جامد', 'كفو', 'برافو', 'مبدع',
    'رهيب', 'خطير', 'جميله', 'حبيت', 'يعجبني', 'عجبني', 'متحمس', 'متحمسة',
    'ضحكت', 'ههههه', 'هههه', 'lol', 'lmao', 'awesome', 'amazing', 'great',
    'good', 'nice', 'love', 'lovely', 'thanks', 'thank', 'happy', 'congrats',
    'congratulations', 'excellent', 'perfect', 'best', 'cool', 'beautiful',
].map(normalizeArabicText);
const NEGATIVE_WORDS = [
    'سيء', 'سيئه', 'وحش', 'وحشة', 'زفت', 'كره', 'غبي', 'فاشل', 'مشكلة', 'مشكله',
    'زعلان', 'حزين', 'تعبان', 'غضبان', 'قرف', 'ملل', 'ممل', 'سخيف', 'خايب',
    'مؤسف', 'للاسف', 'مش عاجبني', 'مش عاجب', 'كراهية', 'تنمر', 'اهانة', 'ضايق',
    'مضايق', 'متضايق', 'بضان', 'هبل', 'خراب', 'عطل', 'انهيار', 'خوف', 'قلق',
    'حزن', 'الم', 'وجع', 'تعب', 'زهق', 'طفش', 'bad', 'terrible', 'awful',
    'hate', 'angry', 'sad', 'worst', 'boring', 'bored', 'trash', 'scam',
    'broken', 'annoying', 'disappointed', 'disappointing', 'stupid', 'useless',
].map(normalizeArabicText);
const POSITIVE_EMOJIS = [
    '😀', '😃', '😄', '😁', '😊', '🙂', '😍', '🥰', '😘', '😎', '🤩',
    '❤️', '❤', '💙', '💚', '💛', '💜', '🤍', '💖', '✨', '🎉', '🎊',
    '👏', '👍', '🔥', '💪', '✅', '🥳', '😂', '🤣',
];
const NEGATIVE_EMOJIS = [
    '😞', '😔', '😟', '😕', '🙁', '☹️', '☹', '😢', '😭', '😡', '😠',
    '🤬', '👎', '💔', '😩', '😫', '😤', '🚫', '❌', '😖', '😣',
];
// --------------------------------------------
// Local analysis
// --------------------------------------------
function countOccurrences(text, term) {
    if (!text || !term)
        return 0;
    let count = 0;
    let index = text.indexOf(term);
    while (index !== -1) {
        count += 1;
        index = text.indexOf(term, index + term.length);
    }
    return count;
}
function scoreMessage(content) {
    const normalized = normalizeArabicText(content);
    let score = 0;
    for (const word of POSITIVE_WORDS) {
        if (normalized.includes(word))
            score += Math.min(2, countOccurrences(normalized, word));
    }
    for (const word of NEGATIVE_WORDS) {
        if (normalized.includes(word))
            score -= Math.min(2, countOccurrences(normalized, word));
    }
    for (const emoji of POSITIVE_EMOJIS) {
        if (content.includes(emoji))
            score += 1;
    }
    for (const emoji of NEGATIVE_EMOJIS) {
        if (content.includes(emoji))
            score -= 1;
    }
    // رسالة واحدة طويلة لا يجب أن تسيطر على مزاج القناة كلها
    return Math.max(-5, Math.min(5, score));
}
function analyzeMoodLocally(messages) {
    const total = messages.length;
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    const emojiCounts = new Map();
    const authorCounts = new Map();
    let totalLength = 0;
    for (const message of messages) {
        const score = scoreMessage(message.content);
        if (score > 0)
            positive += 1;
        else if (score < 0)
            negative += 1;
        else
            neutral += 1;
        totalLength += message.content.length;
        authorCounts.set(message.authorId, (authorCounts.get(message.authorId) || 0) + 1);
        const emojis = message.content.match(/\p{Extended_Pictographic}/gu) || [];
        for (const emoji of emojis) {
            emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
        }
    }
    const posRatio = total ? positive / total : 0;
    const negRatio = total ? negative / total : 0;
    let label = 'neutral';
    if (posRatio >= 0.55 && negRatio <= 0.2)
        label = 'positive';
    else if (negRatio >= 0.55 && posRatio <= 0.2)
        label = 'negative';
    else if (posRatio >= 0.2 && negRatio >= 0.2)
        label = 'mixed';
    const rawScore = total ? 50 + ((positive - negative) / total) * 50 : 50;
    const score = Math.round(Math.max(0, Math.min(100, rawScore)));
    const timestamps = messages
        .map((message) => new Date(message.createdAt).getTime())
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    const spanMs = timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
    const spanMinutes = spanMs / 60_000;
    const perMinute = total ? total / Math.max(1, spanMinutes) : 0;
    return {
        total,
        positive,
        negative,
        neutral,
        score,
        label,
        emojis: [...emojiCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([emoji, count]) => ({ emoji, count })),
        topAuthors: [...authorCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([id, count]) => ({ id, count })),
        perMinute: Math.round(perMinute * 10) / 10,
        spanMinutes: Math.round(spanMinutes * 10) / 10,
        avgLength: total ? Math.round(totalLength / total) : 0,
    };
}
// --------------------------------------------
// AI helpers
// --------------------------------------------
/**
 * يحوّل الرسائل إلى نص مجهول الهوية (عضو 1، عضو 2...) قبل إرساله للنموذج.
 * لا نكشف الأسماء أو المعرفات الحقيقية للذكاء الاصطناعي.
 */
function buildMoodTranscript(messages, maxChars = 12_000) {
    const aliases = new Map();
    let output = '';
    for (let index = 0; index < messages.length; index++) {
        const message = messages[index];
        if (!aliases.has(message.authorId)) {
            aliases.set(message.authorId, `عضو ${aliases.size + 1}`);
        }
        const clean = String(message.content || '')
            .replace(/<@!?\d+>/g, '@عضو')
            .replace(/https?:\/\/\S+/gi, '[رابط]')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240);
        if (!clean)
            continue;
        const line = `[${index + 1}] ${aliases.get(message.authorId)}: ${clean}`;
        if (output.length + line.length + 1 > maxChars)
            break;
        output += (output ? '\n' : '') + line;
    }
    return output;
}
function parseMoodAI(raw) {
    const data = (0, aiJson_1.extractJsonObject)(raw);
    if (!data || typeof data !== 'object')
        return null;
    const allowed = ['positive', 'negative', 'neutral', 'mixed'];
    const mood = allowed.includes(data.mood) ? data.mood : null;
    const summary = String(data.summary || '').trim().slice(0, 1500);
    if (!mood && !summary)
        return null;
    return {
        mood: mood || 'neutral',
        score: Math.round((0, aiJson_1.clampNumber)(data.score, 0, 100, 50)),
        summary,
        emotions: (0, aiJson_1.toStringArray)(data.emotions, 8, 60),
        topics: (0, aiJson_1.toStringArray)(data.topics, 8, 80),
        advice: String(data.advice || '').trim().slice(0, 600),
    };
}
function moodLabelArabic(label) {
    switch (label) {
        case 'positive': return 'إيجابي 🙂';
        case 'negative': return 'سلبي 😞';
        case 'mixed': return 'متقلّب 🎭';
        default: return 'محايد 😐';
    }
}
function moodColor(label) {
    switch (label) {
        case 'positive': return 0x00ff88;
        case 'negative': return 0xff3366;
        case 'mixed': return 0xffd700;
        default: return 0x95a5a6;
    }
}
//# sourceMappingURL=moodAnalysis.js.map