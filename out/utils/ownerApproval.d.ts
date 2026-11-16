import { Guild, GuildMember, User } from 'discord.js';
/** أسماء الميزات للعرض في رسائل الطلب والموافقة */
export declare const PROTECTION_LABELS: Record<string, string>;
/**
 * 🧰 يجمع **كل** الحمايات التي سيتم إطفاؤها في التعديل (وليس أولها فقط).
 * يستخدمها عامل لوحة التحكم لرصد الطلب كله قبل تطبيقه (atomic).
 * العودة: رموز حقول تُستخدم في أزرار الموافقة (ownappr:yes:<field>).
 * الرموز:
 *   • 'antiSpam' / 'antiRaid' / ...            — إطفاء حماية كاملة (prot.<field>.enabled=false)
 *   • 'ownerApproval' / 'blocknames' / ...      — بوليان مستقلة
 *   • 'lockdown' / 'silentSecurityAlerts'       — بوليان مستقلة
 *   • 'aiAutoMod:category:<id>'                 — تعطيل فئة من الذكاء الاصطناعي
 *   • 'path:<dotted.path>'                      — بوليان متداخلة عشوائية (prot.path...=false)
 */
export declare function collectProtectionOffFields(update: any, current: any): string[];
/** 🎯 اسم الحماية للعرض — يدعم استثناءات القنوات بصيغة chan:<channelId>:<check> وفئات الذكاء الاصطناعي aiAutoMod:category:<id> ومسارات path:<dotted> */
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
 * يدعم:
 *  • protection.<feature>.enabled=false
 *  • خصائص بوليان مستقلة: ownerApproval / blockMaliciousNames / lockdown
 *  • بوليان مباشرة أو عبر مسار فرعي: silentSecurityAlerts / punishmentTracker.enabled /
 *    antiBotAbuse.enabled / antiExplicit.enabled / aiAutoMod.enabled / categories.* /
 *    aiTranslator.enabled / showOriginal / aiTicketAssistant.* (analyzeOnCreate/autoClaim/notifyAdminsOnFailure/...)
 *  • مسار حرقي: protection.<feature>.<key> فقط إذا كانت القيمة boolean false تحت مفتاح معروف (categories/...).
 */
export declare function detectProtectionOffField(updates: any): string | null;
export type ProtectionGateOutcome = 'direct_allowed' | 'approval_requested' | 'approved' | 'denied' | 'expired' | 'blocked';
export declare function logProtectionGateDecision(opts: {
    guild: Guild;
    settings?: any;
    field: string;
    outcome: ProtectionGateOutcome;
    userId?: string | null;
    requestedByTag?: string | null;
    source?: string | null;
    note?: string | null;
}): Promise<void>;
/** اختيار قناة يرسل فيها البوت طلب موافقة المالك (سجل الحماية ← قناة النظام ← أول قناة نصية) */
export declare function findApprovalChannel(guild: Guild, settings: any): any | null;
/**
 * 👑 بوابة إطفاء الحماية من **لوحة التحكم** تحديداً.
 * تختلف عن بوابة ديسكورد في أنها تطلب موافقة المالك دائماً (حتى لو خيار
 * ownerApproval نفسه مطفأ) لأن تعديل اللوحة يجب ألا يتجاوز مالك السيرفر.
 * الاستثناء الوحيد: مالك البوت أو حامل أعلى رول (معرّف عبر جلسة Discord).
 * جلسات بلا علم بالهوية (كلمة مرور عامة/Legacy) لا تقدر تُطفئ الحماية بصمت —
 * تُرفض وتُسجل في بوابة الحماية.
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