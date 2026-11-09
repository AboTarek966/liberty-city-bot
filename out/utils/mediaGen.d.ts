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
export declare const DEFAULT_INSTRUMENTAL_PROMPT = "a pleasant instrumental melody, calm and uplifting";
export type Dialect = 'egyptian' | 'gulf' | 'levant' | 'iraqi' | 'msa' | 'english';
/** يكتشف اللهجة المطلوبة من نص المستخدم — الافتراضي مصرية (الأكثر انتشاراً في الأغنية العربية) */
export declare function detectDialect(text: string): Dialect;
/**
 * هل الطلب موسيقى عزفية (بدون غناء) أم أغنية كاملة بكلمات؟
 * القاعدة: "لحن/موسيقى/مقطوعة" منفردة = عزف — أما "أغنية/كلمات/غني" = أغنية كاملة.
 * المستخدم طلب أن يبني البوت أغنية كاملة افتراضياً.
 */
export declare function isInstrumentalOnly(question: string): boolean;
/**
 * يولّد كلمات الأغنية باللهجة المطلوبة.
 * يعيد النص المجهّز بوسوم [verse]/[chorus] أو null عند فشل كل الموديلات.
 * زمن مقاس: ~400-1200ms.
 */
export declare function generateLyrics(topic: string, dialect: Dialect): Promise<string | null>;
export interface SongResult extends GeneratedMedia {
    lyrics: string;
    dialectLabel: string;
}
/**
 * نتيجة توليد الأغنية — قد تنجح بالوسائط أو تفشل مع بقاء الكلمات.
 *
 * ⚠️ حدود خارجية مقاسة (Hugging Face ZeroGPU — مجاني بلا بطاقة):
 *   الحساب المجاني = 5 دقائق GPU يومياً + حد تشغيلات يومي، ويُحتسب كل تشغيل
 *   ACE-Step بستين ثانية على الأقل. عملياً ≈ 5 أغانٍ كل 24 ساعة.
 *   لذلك نُعيد الكلمات المكتوبة دائماً حتى لو تعذّر الغناء — فهي مجانية بلا حدود.
 */
export type SongOutcome = {
    ok: true;
    media: SongResult;
} | {
    ok: false;
    reason: SongFailReason;
    lyrics: string | null;
    dialectLabel: string;
};
export type SongFailReason = 'quota' | 'unavailable' | 'no-lyrics';
/** صياغة عربية صادقة لسبب تعذّر الغناء (تُعرض للمستخدم مباشرة) */
export declare function songFailText(reason: SongFailReason): string;
/**
 * يولّد أغنية كاملة: كلمات باللهجة المطلوبة + غناء + لحن.
 * تُكتب الكلمات أولاً لأنها الأرخص ولا تنفد أبداً — وتبقى صالحة للعرض عند فشل المعالج.
 */
export declare function generateSong(opts: {
    topic: string;
    question: string;
    seconds?: number;
    dialect?: Dialect;
}): Promise<SongOutcome>;
/** يولّد فيديو قصير عبر مساحة Hugging Face — ⚠️ تجريبي (مساحات مجانية بطيئة) */
export declare function generateVideo(prompt: string, opts?: {
    durationSeconds?: number;
    steps?: number;
}): Promise<GeneratedMedia | null>;
/** يلخّص انتظار التوليد لرسالة المستخدم */
export declare function estimateText(kind: 'song' | 'music' | 'video'): string;
//# sourceMappingURL=mediaGen.d.ts.map