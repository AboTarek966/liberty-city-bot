export interface TrustedWhitelistConfig {
    enabled: boolean;
    userIds: string[];
    minorActions: number;
    minorWindowSeconds: number;
    criticalActions: number;
    criticalWindowSeconds: number;
    allowDestructive: boolean;
    logChannel?: string;
}
export declare const DEFAULT_TRUSTED_WHITELIST: TrustedWhitelistConfig;
/** قراءة إعدادات الوايت ليست الموثوقة مع قيم افتراضية آمنة */
export declare function getTrustedWhitelistConfig(settings: any): TrustedWhitelistConfig;
/** هل العضو موجود في الوايت ليست الموثوقة؟ (لا يفحص البوتات — يفحصها المستدعي) */
export declare function isTrustedWhitelistMember(settings: any, userId: string | undefined): boolean;
/** هل الحدث خفيف (إنشاء/تعديل غير مدمّر)؟ */
export declare function isMinorAuditEvent(action: number): boolean;
/** تصنيف مبسّط للاستخدام في منح المساحة */
export declare function auditEventAllowanceKind(action: number): 'minor' | 'critical';
export declare function auditEventLabel(action: number): string;
//# sourceMappingURL=trustedWhitelist.d.ts.map