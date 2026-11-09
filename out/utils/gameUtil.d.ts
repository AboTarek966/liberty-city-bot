/** انتظار ميلي ثانية */
export declare const sleep: (ms: number) => Promise<void>;
/** خلط عشوائي (Fisher–Yates) — يعيد مصفوفة جديدة */
export declare function shuffle<T>(arr: readonly T[]): T[];
/** اختيار عنصر عشوائي واحد */
export declare function pick<T>(arr: readonly T[]): T;
/** اختيار حسب الوزن — للجداول التي تتفاوت فيها ندرة العناصر */
export declare function weightedPick<T extends {
    weight: number;
}>(items: readonly T[]): T;
/** شريط صحة: 🟩 ممتلئ / 🟥 فارغ */
export declare function hpBar(current: number, max: number, length?: number): string;
/** تقييم نصي لنتيجة من 0-100 */
export declare function ratingLine(score: number): string;
//# sourceMappingURL=gameUtil.d.ts.map