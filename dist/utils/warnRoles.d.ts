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
    /** إذا true، يجيب إعدادات طازجة من قاعدة البيانات متجاهلاً الكاش */
    forceFreshSettings?: boolean;
    /** حقل اختياري: يُملأ بسبب الفشل الدقيق */
    diag?: Record<string, any>;
}): Promise<string | null>;
/**
 * 🔄 مزامنة رولات التحذير التسلسلي بعد الإزالة (unwarn):
 * يحسب عدد التحذيرات المتبقي ويضبط الرول accordingly:
 * - 0 تحذيرات → يزيل كل رولات التحذير
 * - 1 → role1Id فقط
 * - 2 → role2Id فقط
 * - 3+ → role3Id فقط
 * يعيد ملاحظة بما تم، أو null لو ما فيش تغيير/إعداد
 */
export declare function syncSequentialAdminWarnRoles(opts: {
    guild: Guild;
    target: GuildMember;
    settings: any;
}): Promise<string | null>;
/**
 * 🔢 إنزال التحذير لمستوى محدد (للإداريين): "شيل 2 @admin"
 * يحذف التحذيرات حتى يصبح عددها = level - 1، ثم يزامن رولات التحذير
 * - شيل 1 → 0 تحذيرات (مسح كامل)
 * - شيل 2 → تحذير واحد
 * - شيل 3 → تحذيران
 */
export declare function removeWarnToLevel(opts: {
    guild: Guild;
    moderator: GuildMember;
    target: GuildMember;
    level: number;
    reason: string;
}): Promise<string>;
/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - للإداريين فقط: نظام تسلسلي تلقائي (1→role1, 2→role2, 3→role3) أو pool adminIds
 * - للأعضاء العاديين: ❌ لا يُعطون أي رول (تحذير عدّاد فقط)
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