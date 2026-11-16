import { Guild, GuildMember, User } from 'discord.js';
/** أسماء الميزات للعرض في رسائل الطلب والموافقة */
export declare const PROTECTION_LABELS: Record<string, string>;
/** 🎯 اسم الحماية للعرض — يدعم استثناءات القنوات بصيغة chan:<channelId>:<check> */
export declare function protectionFieldLabel(field: string): string;
interface PendingApproval {
    field: string;
    requestedBy: string;
    requestedByTag: string;
    expires: number;
}
/** الخيار مفعّل ما لم يُعطَّل صراحة — undefined = مفعّل (آمن افتراضياً) */
export declare function approvalEnabled(settings: any): boolean;
/** هل العضو يحمل أعلى رول موجود في السيرفر؟ */
export declare function hasHighestServerRole(guild: Guild, member: GuildMember | null | undefined): boolean;
/** من يقدر يطفي الحماية مباشرة (بدون طلب موافقة): مالك البوت أو حامل أعلى رول */
export declare function canDirectlyDisableProtection(guild: Guild, userId: string, member?: GuildMember | null, client?: any): Promise<boolean>;
/** من يقدّر "طلب" إطفاء الحماية (أي شخص لديه وصول للإعدادات يمكنه الطلب، والقرار للمخوّلين) */
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
    client?: any;
    member?: GuildMember | null;
}): Promise<string | null>;
/** إرسال رسالة الطلب للمالك (منشن + أزرار موافقة/رفض) */
export declare function requestOwnerApproval(opts: {
    guild: Guild;
    channel: any;
    field: string;
    requestedBy: User;
    /** مصدر الطلب للعرض — مثلاً «لوحة التحكم» */
    source?: string;
}): Promise<'sent' | 'nochannel'>;
/** استخراج الطلب (مرة واحدة فقط + انتهاء الصلاحية) */
export declare function takePending(guildId: string, field: string): PendingApproval | null;
/**
 * 🔎 استخراج أول حماية مطلوب إطفاؤها من تعديل إعدادات قادم من اللوحة.
 * يدعم المسارات: protection.<feature>.enabled=false
 * وخصائص بوليان مستقلة: ownerApproval / blockMaliciousNames.
 */
export declare function detectProtectionOffField(updates: any): string | null;
/** اختيار قناة يرسل فيها البوت طلب موافقة المالك (سجل الحماية ← قناة النظام ← أول قناة نصية) */
export declare function findApprovalChannel(guild: Guild, settings: any): any | null;
/**
 * 👑 بوابة إطفاء الحماية من **لوحة التحكم** تحديداً.
 * تختلف عن بوابة ديسكورد في أنها تطلب موافقة المالك دائماً (حتى لو خيار
 * ownerApproval نفسه مطفأ) لأن تعديل اللوحة يجب ألا يتجاوز مالك السيرفر.
 * الاستثناء الوحيد: مالك السيرفر نفسه أو مطوّر البوت.
 *
 * @returns null = مسموح فوراً · نص = تم إرسال الطلب/مُنع (لا يُطبَّق شيء)
 */
export declare function gateDashboardProtectionOff(opts: {
    settings: any;
    guild: Guild;
    userId?: string;
    field: string;
    client?: any;
}): Promise<string | null>;
export {};
//# sourceMappingURL=ownerApproval.d.ts.map