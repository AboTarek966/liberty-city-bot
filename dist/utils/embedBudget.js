"use strict";
// ============================================
// Liberty City Bot - Embed Budget
// ============================================
// Discord يحسب مجموع أحرف كل الـ Embeds في الرسالة الواحدة (بحد أقصى 6000).
// هذه الأداة تقصّ الحقول غير المحمية من النهاية حتى يبقى الإرسال صالحاً.
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedCharCount = embedCharCount;
exports.fitEmbed = fitEmbed;
function embedCharCount(embed) {
    const data = embed.data || {};
    let total = 0;
    total += String(data.title || '').length;
    total += String(data.description || '').length;
    total += String(data.footer?.text || '').length;
    total += String(data.author?.name || '').length;
    for (const field of data.fields || []) {
        total += String(field.name || '').length;
        total += String(field.value || '').length;
    }
    return total;
}
/**
 * يضمن بقاء الـ Embed تحت الحد الآمن عبر إزالة الحقول غير المحمية من النهاية
 * (الأقل خطورة) ثم قصّ الوصف كحل أخير. يرجع نفس الـ Embed للتسهيل.
 */
function fitEmbed(embed, options = {}) {
    const maxChars = options.maxChars ?? 5600;
    const keepFieldNames = options.keepFieldNames ?? [];
    const isProtected = (name) => keepFieldNames.some((key) => name.includes(key));
    let guard = 40;
    while (embedCharCount(embed) > maxChars && guard-- > 0) {
        const fields = embed.data.fields || [];
        if (!fields.length)
            break;
        let index = -1;
        for (let i = fields.length - 1; i >= 0; i--) {
            if (!isProtected(String(fields[i].name || ''))) {
                index = i;
                break;
            }
        }
        if (index < 0)
            break;
        embed.spliceFields(index, 1);
    }
    const overflow = embedCharCount(embed) - maxChars;
    if (overflow > 0) {
        const description = String(embed.data.description || '');
        const keep = Math.max(0, description.length - overflow - 1);
        embed.setDescription(description.slice(0, keep) + (keep > 0 ? '…' : ''));
    }
    return embed;
}
//# sourceMappingURL=embedBudget.js.map