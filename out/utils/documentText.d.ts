export type DocumentKind = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'odt' | 'rtf' | 'unknown';
export interface ExtractedDocument {
    kind: DocumentKind;
    text: string;
    /** هل النص كافٍ وواضح بدرجة معقولة للإجابة عنه؟ */
    usable: boolean;
}
/** استخراج نص PDF عبر فك ضغط Streams وقراءة مشغّلات النص */
export declare function extractPdfText(buffer: Buffer): string;
export declare function extractDocumentText(buffer: Buffer, name: string, contentType?: string): ExtractedDocument;
//# sourceMappingURL=documentText.d.ts.map