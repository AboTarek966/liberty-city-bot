"use strict";
// ============================================
// Omni Bot - اختصارات مدمجة (تعمل في كل السيرفرات بدون حفظ في قاعدة البيانات)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBuiltinAlias = exports.BUILTIN_ALIASES = void 0;
exports.makeBuiltinAlias = makeBuiltinAlias;
exports.builtinAliasesForDisplay = builtinAliasesForDisplay;
/**
 * BUILTIN_ALIASES: مختصر → أمر.
 * هذه الاختصارات تُدمج تلقائياً مع اختصارات السيرفر في `/alias list`.
 * ملاحظة: ما تُحذفها عبر /alias remove — لأنها مدمجة.
 */
exports.BUILTIN_ALIASES = new Map([
    ['استدعاء', { command: 'call', description: '📢 استدعاء عضو — يرسل البوت له رسالة بأنه مطلوب في القناة' }],
    ['تنتيل', { command: 'demote', description: '⬇️ تنزيل ترقية — إسقاط أعلى رول إدارة من عضو (يبقي الرولات الأدنى)' }],
]);
/** اختصار واحد أم أكثر (يشمل المدمج) */
const isBuiltinAlias = (shortcut) => exports.BUILTIN_ALIASES.has(String(shortcut).toLowerCase().trim());
exports.isBuiltinAlias = isBuiltinAlias;
/** بناء كائن اختصار وهمي للمدمج — مطابق شكل ICommandAlias */
function makeBuiltinAlias(guildId, shortcut) {
    const entry = exports.BUILTIN_ALIASES.get(String(shortcut).toLowerCase().trim());
    if (!entry)
        return null;
    return {
        _id: `builtin-${shortcut}`,
        guildId,
        alias: String(shortcut).toLowerCase().trim(),
        command: entry.command,
        options: {},
        createdBy: 'builtin',
        createdAt: new Date(0),
        updatedAt: new Date(0),
        isBuiltin: true,
    };
}
/** قائمة الاختصارات المدمجة للعرض في /alias list */
function builtinAliasesForDisplay() {
    return [...exports.BUILTIN_ALIASES.entries()].map(([alias, meta]) => ({
        alias,
        command: meta.command,
        description: meta.description,
    }));
}
//# sourceMappingURL=builtinAliases.js.map