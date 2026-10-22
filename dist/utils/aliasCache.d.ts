import { ICommandAlias } from '../models/CommandAlias';
/**
 * جلب الأوامر المرتبطة باختصار معين.
 * نفس الاختصار قد يرتبط بأكثر من أمر (نظام التبديل/Toggle).
 */
export declare function getAliasesForShortcut(guildId: string, shortcut: string): Promise<ICommandAlias[]>;
export declare function invalidateAliasCache(guildId?: string): void;
/**
 * كل اختصارات السيرفر في خريطة واحدة (alias → أوامر).
 * تُستخدم لمطابقة اختصارات متعددة الكلمات (تحتوي مسافات).
 */
export declare function getAllGuildAliases(guildId: string): Promise<Map<string, ICommandAlias[]>>;
//# sourceMappingURL=aliasCache.d.ts.map