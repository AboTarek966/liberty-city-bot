/** نتيجة الكشف */
export interface AbuseMatch {
    /** الكلمة/العبارة كما وردت في القاموس */
    term: string;
    /** الشكل بعد التطبيع */
    normalized: string;
    kind: 'arabic' | 'english' | 'phrase';
}
/** تقليل أي حرف مكرر مرتين أو أكثر إلى حرف واحد (كسسسمك → كسمك) */
export declare function collapseRepeats(s: string): string;
/** تطبيع عربي عدواني: يحافظ على المسافات لكن ينظّفه */
export declare function normalizeArabic(text: string): string;
/** تطبيع إنجليزي مع leetspeak (sh1t → shit) */
export declare function normalizeEnglish(text: string): string;
/** قائمة صريحة: وجودها وحده يجعل الرسالة "موجهة للبوت" */
export declare const HARD_SLURS: string[];
/**
 * يكشف الإساءة في نص واحد.
 * @param extraWords كلمات محظورة إضافية من إعدادات السيرفر
 */
export declare function findAbuse(rawText: string, extraWords?: string[]): AbuseMatch | null;
/** هل النص يحتوي على سب صريح (يُعدّ استهدافاً للبوت حتى بدون منشن)؟ */
export declare function containsHardSlur(rawText: string, extraWords?: string[]): boolean;
/** مخرجات تشخيصية لاختبار الكشف */
export interface AbuseDiagnostics {
    normalizedArabic: string;
    normalizedEnglish: string;
    match: AbuseMatch | null;
    hardSlur: boolean;
}
export declare function diagnoseAbuse(rawText: string, extraWords?: string[]): AbuseDiagnostics;
//# sourceMappingURL=abuseDetector.d.ts.map