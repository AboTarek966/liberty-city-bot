/**
 * BUILTIN_ALIASES: مختصر → أمر.
 * هذه الاختصارات تُدمج تلقائياً مع اختصارات السيرفر في `/alias list`.
 * ملاحظة: ما تُحذفها عبر /alias remove — لأنها مدمجة.
 */
export declare const BUILTIN_ALIASES: Map<string, {
    command: string;
    description: string;
}>;
/** اختصار واحد أم أكثر (يشمل المدمج) */
export declare const isBuiltinAlias: (shortcut: string) => boolean;
/** بناء كائن اختصار وهمي للمدمج — مطابق شكل ICommandAlias */
export declare function makeBuiltinAlias(guildId: string, shortcut: string): any;
/** قائمة الاختصارات المدمجة للعرض في /alias list */
export declare function builtinAliasesForDisplay(): Array<{
    alias: string;
    command: string;
    description: string;
}>;
//# sourceMappingURL=builtinAliases.d.ts.map