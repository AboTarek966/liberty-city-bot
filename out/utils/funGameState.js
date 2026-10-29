"use strict";
// ============================================
// Liberty City Bot - Interactive Game State (حالة الألعاب بأزرار)
// مخزن مؤقت للألعاب التي تحتاج نقرات: لغز / صناديق / قنبلة / بلك جاك
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.newGameId = newGameId;
exports.setFunState = setFunState;
exports.getFunState = getFunState;
exports.delFunState = delFunState;
const store = new Map();
const DEFAULT_TTL = 3 * 60 * 1000; // 3 دقائق لكل جولة
/** مُعرّف قصير عشوائي يدخل في customId */
function newGameId() {
    return Math.random().toString(36).slice(2, 8);
}
function setFunState(id, kind, data, ttl = DEFAULT_TTL) {
    cleanup();
    store.set(id, { kind, data, expiresAt: Date.now() + ttl });
}
/** يعيد الحالة أو null إذا انتهت (ويحذفها في نفس اللحظة) */
function getFunState(id) {
    const s = store.get(id);
    if (!s)
        return null;
    if (Date.now() > s.expiresAt) {
        store.delete(id);
        return null;
    }
    return s;
}
function delFunState(id) {
    store.delete(id);
}
function cleanup() {
    const now = Date.now();
    for (const [id, s] of store) {
        if (now > s.expiresAt)
            store.delete(id);
    }
}
//# sourceMappingURL=funGameState.js.map