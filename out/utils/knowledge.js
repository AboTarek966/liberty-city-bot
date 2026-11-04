"use strict";
// ============================================
// Liberty City Bot - AI Knowledge Search
// ============================================
// بحث محلي سريع (بدون تكلفة AI) في قاعدة معرفة السيرفر.
// يُستخدم في الدردشة العامة وفي مساعد التذاكر.
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeArabic = normalizeArabic;
exports.tokenize = tokenize;
exports.loadKnowledge = loadKnowledge;
exports.searchKnowledge = searchKnowledge;
exports.buildKnowledgeContext = buildKnowledgeContext;
exports.invalidateKnowledgeCache = invalidateKnowledgeCache;
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('Knowledge');
const CACHE_TTL_MS = 30_000;
const cache = new Map();
const ARABIC_STOPWORDS = new Set([
    'من', 'في', 'على', 'عن', 'إلى', 'الى', 'أن', 'ان', 'إن', 'هو', 'هي', 'هم', 'كان', 'كانت',
    'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'ما', 'لا', 'هل', 'ثم', 'أو', 'او', 'و', 'يا',
    'كل', 'بعد', 'قبل', 'عند', 'حتى', 'بين', 'قد', 'لقد', 'لم', 'لن', 'له', 'لها', 'به',
    'بها', 'كما', 'أي', 'اي', 'كيف', 'متى', 'أين', 'اين', 'لماذا', 'وش', 'ايش', 'شنو',
    'لي', 'لك', 'لنا', 'علي', 'عليه', 'عليها', 'انا', 'أنا', 'نحن', 'انت', 'أنت', 'انتم',
    'the', 'and', 'for', 'with', 'that', 'this', 'what', 'how', 'why', 'when', 'where',
    'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'it', 'be', 'do', 'does', 'can',
    'could', 'should', 'would', 'i', 'you', 'we', 'they', 'he', 'she', 'my', 'your',
]);
function normalizeArabic(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, '') // تشكيل
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}
function tokenize(text) {
    return normalizeArabic(text)
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length >= 2 && !ARABIC_STOPWORDS.has(t));
}
function entryText(entry) {
    return normalizeArabic(`${entry.title} ${entry.content} ${(entry.tags || []).join(' ')}`);
}
function scoreEntry(entry, terms, rawQuery) {
    if (!terms.length)
        return 0;
    const title = normalizeArabic(entry.title);
    const content = normalizeArabic(entry.content);
    const tags = (entry.tags || []).map(normalizeArabic);
    const full = entryText(entry);
    const query = normalizeArabic(rawQuery);
    let score = 0;
    if (query.length >= 3 && title.includes(query))
        score += 12;
    if (query.length >= 3 && full.includes(query))
        score += 4;
    for (const term of terms) {
        if (title.includes(term))
            score += 6;
        if (tags.some(tag => tag === term || tag.includes(term)))
            score += 4;
        if (content.includes(term))
            score += 2;
        // تطابق الكلمة كاملة داخل العنوان/المحتوى يعطي وزناً أعلى
        const wordRe = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
        if (wordRe.test(title))
            score += 3;
        if (wordRe.test(content))
            score += 1;
    }
    return score;
}
async function loadKnowledge(guildId) {
    const hit = cache.get(guildId);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS)
        return hit.entries;
    try {
        const entries = await models_1.KnowledgeEntry.find({ guildId, enabled: true })
            .sort({ updatedAt: -1 })
            .limit(400)
            .lean();
        cache.set(guildId, { ts: Date.now(), entries });
        return entries;
    }
    catch (error) {
        logger.warn(`Could not load knowledge for ${guildId}: ${error.message}`);
        return hit?.entries || [];
    }
}
async function searchKnowledge(guildId, query, limit = 5) {
    const terms = tokenize(query);
    if (!terms.length)
        return [];
    const entries = await loadKnowledge(guildId);
    const scored = entries
        .map(entry => ({ entry, score: scoreEntry(entry, terms, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, limit));
    return scored;
}
async function buildKnowledgeContext(guildId, query, limit = 4, maxChars = 3000) {
    try {
        const matches = await searchKnowledge(guildId, query, limit);
        if (!matches.length)
            return '';
        const blocks = [];
        let total = 0;
        for (const [index, match] of matches.entries()) {
            const content = match.entry.content.replace(/\s+/g, ' ').trim().slice(0, 900);
            const block = `[معلومة ${index + 1}] ${match.entry.title}\n` +
                (match.entry.tags?.length ? `الوسوم: ${match.entry.tags.join('، ')}\n` : '') +
                content;
            if (total + block.length > maxChars)
                break;
            blocks.push(block);
            total += block.length;
        }
        if (!blocks.length)
            return '';
        return (`\n\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📚 **قاعدة معرفة السيرفر (مصدر موثوق — قدّمها على تخمينك):**\n` +
            `استخدم هذه المعلومات عند الإجابة، وإذا تعارضت معها فاذكر التعارض بوضوح.\n\n` +
            blocks.join('\n\n---\n\n'));
    }
    catch (error) {
        logger.warn(`buildKnowledgeContext failed: ${error.message}`);
        return '';
    }
}
function invalidateKnowledgeCache(guildId) {
    if (guildId)
        cache.delete(guildId);
    else
        cache.clear();
}
//# sourceMappingURL=knowledge.js.map