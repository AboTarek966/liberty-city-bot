"use strict";
// ============================================
// Liberty City Bot - Game Utilities (أدوات الألعاب المشتركة)
// تُستخدم من أوامر الترفيه — بلا اعتماديات خارجية
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
exports.shuffle = shuffle;
exports.pick = pick;
exports.weightedPick = weightedPick;
exports.hpBar = hpBar;
exports.ratingLine = ratingLine;
/** انتظار ميلي ثانية */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
exports.sleep = sleep;
/** خلط عشوائي (Fisher–Yates) — يعيد مصفوفة جديدة */
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
/** اختيار عنصر عشوائي واحد */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
/** اختيار حسب الوزن — للجداول التي تتفاوت فيها ندرة العناصر */
function weightedPick(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    for (const item of items) {
        r -= item.weight;
        if (r <= 0)
            return item;
    }
    return items[items.length - 1];
}
/** شريط صحة: 🟩 ممتلئ / 🟥 فارغ */
function hpBar(current, max, length = 10) {
    const ratio = max > 0 ? current / max : 0;
    const filled = Math.max(0, Math.min(length, Math.round(ratio * length)));
    return '🟩'.repeat(filled) + '🟥'.repeat(length - filled);
}
/** تقييم نصي لنتيجة من 0-100 */
function ratingLine(score) {
    if (score >= 95)
        return '🏆 أسطورة مطلقة!';
    if (score >= 80)
        return '🔥 أداء رهيب!';
    if (score >= 60)
        return '👏 أداء جيد جداً';
    if (score >= 40)
        return '🙂 مقبول، تقدر أحسن';
    if (score >= 20)
        return '😅 يحتاج تدريب';
    return '💀 كارثة... جرّب مرة ثانية';
}
//# sourceMappingURL=gameUtil.js.map