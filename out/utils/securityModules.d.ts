import { AuditLogEvent } from 'discord.js';
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';
export type SecurityAction = 'alert' | 'kick' | 'ban' | 'strip';
export interface SecurityModuleDefinition {
    /** مفتاح ثابت يُحفظ في قاعدة البيانات */
    key: string;
    /** اسم عربي مختصر */
    name: string;
    emoji: string;
    description: string;
    category: string;
    severity: SecuritySeverity;
    /** أحداث سجل التدقيق التي تغطيها الوحدة */
    events: AuditLogEvent[];
    /** الحد الافتراضي داخل النافذة */
    defaultLimit: number;
    /** النافذة الزمنية الافتراضية بالثواني */
    defaultWindowSeconds: number;
    /** العقوبة الافتراضية عند التجاوز */
    defaultAction: SecurityAction;
    /** هل الحدث إنشائي/خفيف؟ (يمنح الوايت ليست الموثوقة مساحة أكبر) */
    minor: boolean;
    /** فلتر اختياري لسجل التدقيق — يُستخدم لتجاهل تغييرات غير مهمة */
    match?: (entry: any) => boolean;
    /** تسمية الحدث للتنبيهات */
    eventLabels?: Partial<Record<AuditLogEvent, string>>;
}
export declare const SECURITY_MODULES: SecurityModuleDefinition[];
export declare function getSecurityModule(key: string): SecurityModuleDefinition | undefined;
export declare function securityModulesForEvent(action: number): SecurityModuleDefinition[];
export declare const SECURITY_MODULE_KEYS: string[];
export declare const SECURITY_CATEGORIES: string[];
export declare const SEVERITY_LABELS: Record<SecuritySeverity, string>;
export declare function moduleDefaultConfig(mod: SecurityModuleDefinition): {
    enabled: boolean;
    limit: number;
    windowSeconds: number;
    action: SecurityAction;
};
//# sourceMappingURL=securityModules.d.ts.map