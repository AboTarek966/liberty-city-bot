import { Guild, User } from 'discord.js';
/** أسماء الميزات للعرض في رسائل الطلب والموافقة */
export declare const PROTECTION_LABELS: Record<string, string>;
interface PendingApproval {
    field: string;
    requestedBy: string;
    requestedByTag: string;
    expires: number;
}
/** الخيار مفعّل ما لم يُعطَّل صراحة — undefined = مفعّل (آمن افتراضياً) */
export declare function approvalEnabled(settings: any): boolean;
/** من يقدّرون "طلب" إطفاء الحماية (الموافقة نفسها للمالك وحده) */
export declare function canRequestProtectionOff(settings: any, guild: Guild, userId: string): boolean;
/**
 * بوابة "إطفاء الحماية" — تُستدعى قبل تطبيق أي إطفاء.
 * تُعيد: null → مسموح بالتطبيق الفوري · نص → مُنع أو أُرسل طلب للمالك (لا يُطبَّق شيء).
 */
export declare function gateProtectionOff(opts: {
    settings: any;
    guild: Guild;
    user: User;
    channel: any;
    field: string;
}): Promise<string | null>;
/** إرسال رسالة الطلب للمالك (منشن + أزرار موافقة/رفض) */
export declare function requestOwnerApproval(opts: {
    guild: Guild;
    channel: any;
    field: string;
    requestedBy: User;
}): Promise<'sent' | 'nochannel'>;
/** استخراج الطلب (مرة واحدة فقط + انتهاء الصلاحية) */
export declare function takePending(guildId: string, field: string): PendingApproval | null;
export {};
//# sourceMappingURL=ownerApproval.d.ts.map