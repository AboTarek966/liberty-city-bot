// ============================================
// Liberty City Bot - Game Utilities (أدوات الألعاب المشتركة)
// تُستخدم من أوامر الترفيه — بلا اعتماديات خارجية
// ============================================

/** انتظار ميلي ثانية */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** خلط عشوائي (Fisher–Yates) — يعيد مصفوفة جديدة */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** اختيار عنصر عشوائي واحد */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** اختيار حسب الوزن — للجداول التي تتفاوت فيها ندرة العناصر */
export function weightedPick<T extends { weight: number }>(items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/** شريط صحة: 🟩 ممتلئ / 🟥 فارغ */
export function hpBar(current: number, max: number, length = 10): string {
  const ratio = max > 0 ? current / max : 0;
  const filled = Math.max(0, Math.min(length, Math.round(ratio * length)));
  return '🟩'.repeat(filled) + '🟥'.repeat(length - filled);
}

/** تقييم نصي لنتيجة من 0-100 */
export function ratingLine(score: number): string {
  if (score >= 95) return '🏆 أسطورة مطلقة!';
  if (score >= 80) return '🔥 أداء رهيب!';
  if (score >= 60) return '👏 أداء جيد جداً';
  if (score >= 40) return '🙂 مقبول، تقدر أحسن';
  if (score >= 20) return '😅 يحتاج تدريب';
  return '💀 كارثة... جرّب مرة ثانية';
}
