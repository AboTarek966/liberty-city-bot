// ============================================
// Omni Bot - اختصارات مدمجة (تعمل في كل السيرفرات بدون حفظ في قاعدة البيانات)
// ============================================

/**
 * BUILTIN_ALIASES: مختصر → أمر.
 * هذه الاختصارات تُدمج تلقائياً مع اختصارات السيرفر في `/alias list`.
 * ملاحظة: ما تُحذفها عبر /alias remove — لأنها مدمجة.
 */
export const BUILTIN_ALIASES: Map<string, { command: string; description: string }> = new Map([
  ['استدعاء', { command: 'call', description: '📢 استدعاء عضو — يرسل البوت له رسالة بأنه مطلوب في القناة' }],
  ['تنتيل', { command: 'demote', description: '⬇️ تنزيل ترقية — إسقاط أعلى رول إدارة من عضو (يبقي الرولات الأدنى)' }],
]);

/** اختصار واحد أم أكثر (يشمل المدمج) */
export const isBuiltinAlias = (shortcut: string): boolean =>
  BUILTIN_ALIASES.has(String(shortcut).toLowerCase().trim());

/** بناء كائن اختصار وهمي للمدمج — مطابق شكل ICommandAlias */
export function makeBuiltinAlias(guildId: string, shortcut: string): any {
  const entry = BUILTIN_ALIASES.get(String(shortcut).toLowerCase().trim());
  if (!entry) return null;
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
export function builtinAliasesForDisplay(): Array<{ alias: string; command: string; description: string }> {
  return [...BUILTIN_ALIASES.entries()].map(([alias, meta]) => ({
    alias,
    command: meta.command,
    description: meta.description,
  }));
}
