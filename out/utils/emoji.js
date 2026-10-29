"use strict";
// ============================================
// Liberty City Bot - Emoji utils
// تحويل اختصارات إيموجي السيرفر (:اسم:) إلى إيموجي حقيقي
// يُستخدم في كل الرسائل التلقائية (الردود التلقائية، الترحيب، المغادرة، ردود الذكاء)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEmojiShortcodes = resolveEmojiShortcodes;
exports.normalizeEmojiForMatch = normalizeEmojiForMatch;
/**
 * 🎨 تحويل اختصارات إيموجي السيرفر (:اسم:) إلى إيموجي حقيقي <:اسم:id>
 *    ديسكورد لا يحوّل الاختصارات تلقائياً في رسائل البوت (تظهر كنص خام مثل ":اسم:") —
 *    نبحث في كاش إيموجي السيرفر ونستبدلها، وما لا يُوجد في السيرفر يبقى نصاً كما هو
 *    (إيموجي سيرفر آخر لا يظهر — لازم يكون من نفس السيرفر)
 */
function resolveEmojiShortcodes(text, guild) {
    if (!guild || !text.includes(':'))
        return text;
    const emojis = guild.emojis.cache;
    if (!emojis.size)
        return text;
    // 🚫 لا نلمس الإيموجي المكتوب كاملاً <:اسم:id> / <a:اسم:id> (الملصوق من قائمة الإيموجي) —
    //    بدون هذا الاستثناء كانت ":اسم:" داخله تُستبدل فتُنتج شكلاً مكرراً مثل <<:اسم:id>id>
    return text.replace(/:([\w-]{1,32}):(?!\d+>)/g, (match, name) => {
        const emoji = emojis.find((e) => e.name?.toLowerCase() === name.toLowerCase());
        if (!emoji)
            return match;
        return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
    });
}
/**
 * 🎯 توحيد شكل الإيموجي للمطابقة — يتعرّف على الإيموجي مهما كُتب:
 *    - `<:اسم:id>` و `<a:اسم:id>` ← `:اسم:` (مطابقة بالاسم — الرقم غير مطلوب)
 *    - يزيل علامات العرض FE0F/FE0E ودرجات البشرة لتطابق ❤️ مع ❤ و👍 مع 👍🏽
 *    يُستخدم في مطابقة الردود التلقائية: اكتب المحفّز كإيموجي عادي أو اختصار — كلاهما يشتغل
 */
function normalizeEmojiForMatch(text) {
    return text
        .replace(/<a?:([\w-]{1,32}):\d+>/g, ':$1:')
        .replace(/[\uFE0F\uFE0E]/g, '')
        .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
        .toLowerCase();
}
//# sourceMappingURL=emoji.js.map