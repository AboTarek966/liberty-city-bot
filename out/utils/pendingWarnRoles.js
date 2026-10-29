"use strict";
// ============================================
// Liberty City Bot - تغييرات رولات التحذير المُعلّقة
// المستخدم يختار الرولات ← تُحفظ مؤقتاً هنا ← ثم يؤكد أو يلغي
// (بدون لمس قاعدة البيانات قبل التأكيد)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPendingWarnRoles = setPendingWarnRoles;
exports.getPendingWarnRoles = getPendingWarnRoles;
exports.clearPendingWarnRoles = clearPendingWarnRoles;
exports.hasPendingWarnRoles = hasPendingWarnRoles;
exports.pendingDiffers = pendingDiffers;
const TTL_MS = 15 * 60 * 1000; // 15 دقيقة ثم تُنسى تلقائياً
const store = new Map();
/** يجمع التغييرات الجديدة مع أي تغييرات مُعلّقة سابقاً بنفس السيرفر */
function setPendingWarnRoles(guildId, patch, userId) {
    const prev = getPendingWarnRoles(guildId);
    const next = {
        ...(prev || {}),
        ...patch,
        userId,
        at: Date.now(),
    };
    store.set(guildId, next);
    return next;
}
function getPendingWarnRoles(guildId) {
    const p = store.get(guildId);
    if (!p)
        return undefined;
    if (Date.now() - p.at > TTL_MS) {
        store.delete(guildId);
        return undefined;
    }
    return p;
}
function clearPendingWarnRoles(guildId) {
    store.delete(guildId);
}
/** هل يوجد أي تغيير مُعلّق فعلاً؟ */
function hasPendingWarnRoles(p) {
    if (!p)
        return false;
    return !!(p.members || p.admins || p.sequential);
}
/** هل التغيير المُعلّق فارغ بالكامل (أي: مسح كل شيء)؟ — نعتبره تغييراً أيضاً */
function pendingDiffers(p, current) {
    if (!p)
        return false;
    const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
    if (p.members && !same(p.members, current.memberIds))
        return true;
    if (p.admins && !same(p.admins, current.adminIds))
        return true;
    if (p.sequential && !same(p.sequential, current.sequential))
        return true;
    return false;
}
//# sourceMappingURL=pendingWarnRoles.js.map