export interface GeneratedMedia {
    data: Buffer;
    ext: string;
    mimeType: string;
    /** النص الخام للنموذج (اختياري — بعض المساحات ترجع وصفاً) */
    note?: string;
}
/** هل توليد الوسائط متاح؟ (يحتاج HF_TOKEN) */
export declare function mediaGenAvailable(): {
    music: boolean;
    video: boolean;
    reason?: string;
};
export declare function detectMusicPrompt(text: string): string | null;
export declare function detectVideoPrompt(text: string): string | null;
/** يولّد موسيقى عبر مساحة Hugging Face (Stable Audio 3) */
export declare function generateMusic(prompt: string, opts?: {
    seconds?: number;
    variant?: 'medium' | 'small-music' | 'small-sfx';
}): Promise<GeneratedMedia | null>;
/** يولّد فيديو قصير عبر مساحة Hugging Face — ⚠️ تجريبي (مساحات مجانية بطيئة) */
export declare function generateVideo(prompt: string, opts?: {
    durationSeconds?: number;
    steps?: number;
}): Promise<GeneratedMedia | null>;
/** يلخّص انتظار التوليد لرسالة المستخدم */
export declare function estimateText(kind: 'music' | 'video'): string;
//# sourceMappingURL=mediaGen.d.ts.map