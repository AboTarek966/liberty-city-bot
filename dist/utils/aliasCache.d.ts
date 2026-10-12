import { ICommandAlias } from '../models/CommandAlias';
/**
 * جلب الأوامر المرتبطة باختصار معين.
 * نفس الاختصار قد يرتبط بأكثر من أمر (نظام التبديل/Toggle).
 */
export declare function getAliasesForShortcut(guildId: string, shortcut: string): Promise<ICommandAlias[]>;
export declare function invalidateAliasCache(guildId?: string): void;
//# sourceMappingURL=aliasCache.d.ts.map