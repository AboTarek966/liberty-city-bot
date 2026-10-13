export interface HFResult {
    /** ملفات الناتج (مسارات مطلقة على خادم HF، أو base64) */
    files: string[];
    /** النص الخام للنتيجة (للاستخراج اليدوي) */
    raw: unknown;
}
/** يحول معرّف المساحة "Org/Name" إلى اسم المضيف "org-name" */
export declare function spaceHost(spaceId: string): string;
/** يوقظ المساحة النائمة — أول طلب قد يفشل بدون هذا */
export declare function wakeSpace(spaceId: string): Promise<void>;
/** يجلب مخطّط واجهة المساحة (الأسماء والمعاملات) — مفيد للتشخيص */
export declare function getSpaceInfo(spaceId: string): Promise<any>;
/**
 * يستدعي دالة في مساحة Gradio عبر الطابور ويعيد النتيجة.
 * @param fnIndex ترقيم الدالة في مساحة المساحة (من /config → dependencies[i])
 *                مثال: Stable Audio 3 → /infer هو fn_index 3
 */
export declare function callSpaceFn(spaceId: string, fnIndex: number, data: unknown[], opts?: {
    timeoutMs?: number;
}): Promise<HFResult>;
/** يحمّل ملف الناتج إلى Buffer (مع سقف حجم) */
export declare function downloadResult(url: string, opts?: {
    maxBytes?: number;
    timeoutMs?: number;
}): Promise<Buffer>;
//# sourceMappingURL=hfSpaces.d.ts.map