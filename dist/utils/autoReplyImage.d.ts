/** أقصى حجم للملف الأصلي قبل الضغط */
export declare const AUTO_REPLY_IMAGE_MAX_INPUT: number;
/** أقصى حجم للصورة بعد الضغط — base64 يزيد الحجم ~33% لكنه يبقى ضمن حدود Mongo */
export declare const AUTO_REPLY_IMAGE_MAX_STORED = 1500000;
export interface PreparedAutoReplyImage {
    base64: string;
    mimeType: string;
    /** الاسم الأصلي للعرض فقط — اسم المرفق في ديسكورد ثابت وآمن */
    name: string;
    bytes: number;
    width?: number;
    height?: number;
}
export declare function extensionForMime(mime: string): string;
/** اسم مرفق ثابت وآمن لاستخدامه في attachment:// */
export declare function autoReplyAttachmentName(mime: string): string;
/** فك base64 المحفوظ مع حدود أمان */
export declare function getAutoReplyImageBuffer(cfg: any): Buffer | null;
/** تنزيل مرفق ديسكورد مع حد أقصى للحجم */
export declare function downloadAutoReplyAttachment(url: string): Promise<Buffer>;
/**
 * ضغط الصورة وتجهيزها للتخزين.
 * الصور الصغيرة تبقى بصيغتها، والكبيرة تُحوّل JPEG بأبعاد مناسبة.
 */
export declare function prepareAutoReplyImage(buffer: Buffer, mimeType: string, originalName?: string): Promise<PreparedAutoReplyImage>;
//# sourceMappingURL=autoReplyImage.d.ts.map