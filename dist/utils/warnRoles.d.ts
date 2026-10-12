import { Guild, GuildMember } from 'discord.js';
export declare function isAdminTarget(target: GuildMember): boolean;
export declare function getWarnRolePool(settings: any, target: GuildMember): string[];
/**
 * الحصول على عدد تحذيرات عضو في هذا السيرفر
 */
export declare function getWarningCount(guildId: string, userId: string): Promise<number>;
/**
 * تطبيق نظام التحذيرات التسلسلي للإداريين:
 * - تحذير 1 → role1Id
 * - تحذير 2 → role2Id
 * - تحذير 3 → role3Id
 * يعيد ملاحظة نصية بما تم، أو null لو ما فيش إعداد
 */
export declare function applySequentialAdminWarnRoles(opts: {
    settings: any;
    guild: Guild;
    executor: GuildMember;
    target: GuildMember;
    reason: string;
}): Promise<string | null>;
/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - للإداريين: نظام تسلسلي تلقائي (1→role1, 2→role2, 3→role3)
 * - للأعضاء: رول واحد فقط → يُعطى مباشرة، أو لوحة اختيار
 * - لا توجد رولات قابلة → يُرجع null
 */
export declare function offerWarnRoles(opts: {
    settings: any;
    guild: Guild;
    executor: GuildMember;
    target: GuildMember;
    reason: string;
    reply: (payload: {
        content: string;
        components: any[];
    }) => Promise<unknown>;
}): Promise<string | null>;
//# sourceMappingURL=warnRoles.d.ts.map