/**
 * توحيد الاسم: حروف صغيرة + إزالة الزخارف والمسافات الصفرية والتشكيل،
 * ثم تحويل أي رمز/إيموجي إلى مسافة — حتى لا يفلت الاسم المُموّه.
 */
export declare function normalizeSecurityName(raw: unknown): string;
/** هل هذا الاسم قناة/رول تخريبية؟ */
export declare function isMaliciousSecurityName(raw: unknown): boolean;
//# sourceMappingURL=securityNames.d.ts.map