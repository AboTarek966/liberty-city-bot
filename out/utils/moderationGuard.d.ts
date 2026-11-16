import { GuildMember } from 'discord.js';
export interface TimeoutabilityCheck {
    /** هل يمكن محاولة الكتم (قد يرفضه Discord لاحقاً) */
    canAttempt: boolean;
    /** سبب المنع أو التحذير بالعربية */
    reason?: string;
    /** العضو لديه Administrator: نحاول الكتم لكن Discord غالباً يرفضه */
    administrator?: boolean;
}
export declare function checkTimeoutability(member: GuildMember): TimeoutabilityCheck;
/** رسالة فشل واضحة عند رفض Discord للكتم */
export declare function describeTimeoutApiError(member: GuildMember, error: any): string;
//# sourceMappingURL=moderationGuard.d.ts.map