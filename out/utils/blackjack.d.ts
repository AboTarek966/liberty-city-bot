export declare const RANKS: string[];
export declare const SUITS: string[];
export interface Card {
    r: string;
    s: string;
}
/** رزمة52 ورقة مخلوطة */
export declare function newDeck(): Card[];
/** قيمة ورقة واحدة (الآس11 ثم يُخفض لـ1 إذا تجاوزت21) */
export declare function cardValue(r: string): number;
/** مجموع اليد مع معالجة الآس المرن (1 أو11) */
export declare function handValue(hand: Card[]): number;
/** عرض اليد — إخفاء أول ورقة للموزع حتى يقف اللاعب */
export declare function renderHand(hand: Card[], hideFirst?: boolean): string;
/** الموزع يسحب حتى يصل17 أو أكثر (القاعدة الكلاسيكية) */
export declare function dealerDraw(dealer: Card[], deck: Card[]): void;
//# sourceMappingURL=blackjack.d.ts.map