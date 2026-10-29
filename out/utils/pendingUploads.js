"use strict";
// ============================================
// رفع مباشر لصورة لوحة التذاكر
// الزر يطلب الرفع → أول رسالة مرفقة من نفس المستخدم تصبح صورة اللوحة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPendingImageUpload = setPendingImageUpload;
exports.consumePendingImageUpload = consumePendingImageUpload;
exports.hasPendingImageUpload = hasPendingImageUpload;
const pending = new Map();
const TTL_MS = 60_000; // 60 ثانية لاختيار الصورة
function setPendingImageUpload(userId, guildId, channelId, kind = 'ticket') {
    pending.set(userId, { guildId, channelId, userId, kind, expiresAt: Date.now() + TTL_MS });
}
function consumePendingImageUpload(userId) {
    const entry = pending.get(userId);
    if (!entry)
        return null;
    pending.delete(userId);
    if (Date.now() > entry.expiresAt)
        return null;
    return entry;
}
function hasPendingImageUpload(userId) {
    const entry = pending.get(userId);
    if (!entry)
        return false;
    if (Date.now() > entry.expiresAt) {
        pending.delete(userId);
        return false;
    }
    return true;
}
//# sourceMappingURL=pendingUploads.js.map