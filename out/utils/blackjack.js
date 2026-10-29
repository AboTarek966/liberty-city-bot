"use strict";
// ============================================
// Liberty City Bot - Blackjack Utilities (أدوات بلك جاك)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUITS = exports.RANKS = void 0;
exports.newDeck = newDeck;
exports.cardValue = cardValue;
exports.handValue = handValue;
exports.renderHand = renderHand;
exports.dealerDraw = dealerDraw;
exports.RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
exports.SUITS = ['♠', '♥', '♦', '♣'];
/** رزمة52 ورقة مخلوطة */
function newDeck() {
    const deck = [];
    for (const r of exports.RANKS)
        for (const s of exports.SUITS)
            deck.push({ r, s });
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}
/** قيمة ورقة واحدة (الآس11 ثم يُخفض لـ1 إذا تجاوزت21) */
function cardValue(r) {
    if (r === 'A')
        return 11;
    if (r === 'J' || r === 'Q' || r === 'K')
        return 10;
    return Number.parseInt(r, 10);
}
/** مجموع اليد مع معالجة الآس المرن (1 أو11) */
function handValue(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
        total += cardValue(c.r);
        if (c.r === 'A')
            aces++;
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}
/** عرض اليد — إخفاء أول ورقة للموزع حتى يقف اللاعب */
function renderHand(hand, hideFirst = false) {
    if (hideFirst && hand.length) {
        return `🎴 ? ${hand.slice(1).map((c) => `${c.r}${c.s}`).join(' ')}`;
    }
    return hand.map((c) => `${c.r}${c.s}`).join(' ');
}
/** الموزع يسحب حتى يصل17 أو أكثر (القاعدة الكلاسيكية) */
function dealerDraw(dealer, deck) {
    while (handValue(dealer) < 17) {
        const card = deck.pop();
        if (!card)
            break;
        dealer.push(card);
    }
}
//# sourceMappingURL=blackjack.js.map