/** موديلات الرؤية على Groq (مرتّبة بالأفضل) */
export declare const VISION_MODELS: string[];
/** موديلات التفريغ الصوتي (STT) على Groq */
export declare const STT_MODELS: string[];
export interface AttachmentAnalysis {
    /** نص وصفي جاهز لحقنه في سياق الـ AI */
    context: string;
    /** هل تم تحليل شيء فعلياً */
    analyzed: boolean;
    /** الصور كـ base64 — تُمرَّر مباشرة لنموذج الرؤية */
    images: Array<{
        data: string;
        mimeType: string;
    }>;
    /** عدد الوسائط التي عالجها */
    processed: number;
}
export declare function analyzeAttachments(attachments: Array<{
    id: string;
    name?: string | null;
    url: string;
    contentType?: string | null;
    size?: number | null;
    duration?: number | null;
    flags?: number | null;
    height?: number | null;
    width?: number | null;
}>, opts: {
    apiKey?: string;
    question?: string;
    canSeeImages?: boolean;
}): Promise<AttachmentAnalysis>;
/** هل يحتوي الرسالة على وسائط قابلة للتحليل؟ */
export declare function hasAnalyzableAttachments(attachments: Array<{
    contentType?: string | null;
    name?: string | null;
    flags?: number | null;
}>): boolean;
//# sourceMappingURL=attachmentAnalyzer.d.ts.map