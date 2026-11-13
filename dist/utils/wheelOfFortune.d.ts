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
}
/**
 * رسم عجلة الحظ كـ GIF متحرك.
 * @returns Buffer للـ GIF — ارسله كـ attachment.
 */
export declare function renderWheelOfFortuneGif(opts: WheelOfFortuneOptions): Promise<Buffer>;
/** تحميل آفاتار ديسكورد كـ Buffer (null عند الفشل — لا تُرمي) */
export declare function fetchAvatarBuffer(url: string): Promise<Buffer | null>;
//# sourceMappingURL=wheelOfFortune.d.ts.map