export interface WheelSegmentInput {
    /** النص القصير الذي يظهر على القطعة (يفضل اسم المستخدم/مقبض ديسكورد ASCII) */
    label: string;
    /** صورة دائرية للقطعة (آفاتار عضو أو أيقونة جائزة) — اختياري */
    image?: Buffer | null;
    /** وزن اختياري لعرض قطع بأحجام متفاوتة — التوزيع الفعلي يبقى عشوائياً داخلياً */
    color?: string;
}
export interface WheelOfFortuneOptions {
    title: string;
    subtitle?: string;
    segments: WheelSegmentInput[];
    /** القطعة التي ستستقر عليها العجلة */
    winnerIndex: number;
    width?: number;
    frames?: number;
    delayMs?: number;
    holdMs?: number;
    hubText?: string;
    /** 📐 portrait (عمودي — الافتراضي) أو landscape (عريض 16:9 بلوحة مشاركين) */
    orientation?: 'portrait' | 'landscape';
    /** نص التمييز بجانب الفائز في اللوحة/الصورة (افتراضي: الفائز) */
    resultLabel?: string;
    /**
     * 🖼️ صيغة المخرجات:
     * - 'gif' (افتراضي): GIF متحرك
     * - 'png': صورة ثابتة أخف بكثير على المعالج (موصى به عند الضغط العالي)
     */
    format?: 'gif' | 'png';
    /** تجاهل الكاش وإرجاع صورة جديدة */
    noCache?: boolean;
}
/**
 * رسم عجلة الحظ كـ GIF متحرك.
 * @returns Buffer للـ GIF — ارسله كـ attachment.
 */
export declare function renderWheelOfFortuneGif(opts: WheelOfFortuneOptions): Promise<Buffer>;
export declare function fetchAvatarBuffer(url: string): Promise<Buffer | null>;
//# sourceMappingURL=wheelOfFortune.d.ts.map