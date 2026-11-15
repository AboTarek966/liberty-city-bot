/** يطبّع النص العربي/الإنجليزي للمقارنة */
export declare function normalizeBadWord(text: string): string;
/**
 * يرجع أول كلمة محظورة تطابق النص، أو null لو مفيش تطابق.
 * مطابقة على مستوى الكلمة — لا تطابق مقاطع فرعية ("تكسير" ما يتربطش بـ"كس").
 */
export declare function findBadWord(text: string, badWords: string[]): string | null;
export declare function matchesAnyBadWord(text: string, badWords: string[]): boolean;
//# sourceMappingURL=badWords.d.ts.map