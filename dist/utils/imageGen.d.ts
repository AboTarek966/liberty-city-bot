export interface GeneratedImage {
    data: Buffer;
    mimeType: string;
    ext: string;
}
/**
 * يكشف هل طلب المستخدم توليد صورة، ويعيد الوصف النظيف.
 * يعيد `null` إذا لم يكن طلب صورة.
 */
export declare function detectImagePrompt(text: string): string | null;
/** يولّد صورة واحدة عبر Pollinations.ai */
export declare function generatePollinationsImage(prompt: string, opts?: {
    width?: number;
    height?: number;
    model?: string;
}): Promise<GeneratedImage | null>;
/**
 * يولّد صورة مع إعادة المحاولة — المجاني أحياناً يتأخر أو يرجع خطأ مؤقت.
 * المهلة تتزايد تدريجياً (1.2s ثم 2.4s) حتى لا نغرق الخدمة.
 */
export declare function generateImageWithRetry(prompt: string, opts?: {
    width?: number;
    height?: number;
    model?: string;
}, attempts?: number): Promise<GeneratedImage | null>;
//# sourceMappingURL=imageGen.d.ts.map