// ============================================
// Liberty City Bot - Blackjack Utilities (أدوات بلك جاك)
// ============================================

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];

export interface Card {
  r: string;
  s: string;
}

/** رزمة52 ورقة مخلوطة */
export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** قيمة ورقة واحدة (الآس11 ثم يُخفض لـ1 إذا تجاوزت21) */
export function cardValue(r: string): number {
  if (r === 'A') return 11;
  if (r === 'J' || r === 'Q' || r === 'K') return 10;
  return Number.parseInt(r, 10);
}

/** مجموع اليد مع معالجة الآس المرن (1 أو11) */
export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += cardValue(c.r);
    if (c.r === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

/** عرض اليد — إخفاء أول ورقة للموزع حتى يقف اللاعب */
export function renderHand(hand: Card[], hideFirst = false): string {
  if (hideFirst && hand.length) {
    return `🎴 ? ${hand.slice(1).map((c) => `${c.r}${c.s}`).join(' ')}`;
  }
  return hand.map((c) => `${c.r}${c.s}`).join(' ');
}

/** الموزع يسحب حتى يصل17 أو أكثر (القاعدة الكلاسيكية) */
export function dealerDraw(dealer: Card[], deck: Card[]): void {
  while (handValue(dealer) < 17) {
    const card = deck.pop();
    if (!card) break;
    dealer.push(card);
  }
}
