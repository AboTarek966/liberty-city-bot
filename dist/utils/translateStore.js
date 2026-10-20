"use strict";
// ============================================
// Liberty City Bot - Translate Store
// ============================================
// تخزين مؤقت لسياق الترجمة حتى تستطيع أزرار
// (نسخ/إعادة/تغيير اللغة) الوصول للنص الأصلي
// بعد إعادة تشغيل البوت يُنسى تلقائياً (مقبول)
Object.defineProperty(exports, "__esModule", { value: true });
exports.putTranslation = putTranslation;
exports.getTranslation = getTranslation;
const store = new Map();
const TTL = 30 * 60 * 1000; // 30 دقيقة
const MAX = 500;
function putTranslation(messageId, data) {
    // تنظيف المنتهية الصلاحية عند كل إضافة
    const now = Date.now();
    for (const [k, v] of store) {
        if (now - v.at > TTL)
            store.delete(k);
    }
    if (store.size >= MAX) {
        const oldest = store.keys().next().value;
        if (oldest)
            store.delete(oldest);
    }
    store.set(messageId, { ...data, at: now });
}
function getTranslation(messageId) {
    const item = store.get(messageId);
    if (!item)
        return null;
    if (Date.now() - item.at > TTL) {
        store.delete(messageId);
        return null;
    }
    return item;
}
//# sourceMappingURL=translateStore.js.map