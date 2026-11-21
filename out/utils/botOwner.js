"use strict";
// ============================================
// Omni Bot - 👑 تحقق من ملكية البوت
// يحدد المالك تلقائياً من بيئة العمل أو من مالك التطبيق في Discord
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnvBotOwner = isEnvBotOwner;
exports.getBotOwnerIds = getBotOwnerIds;
exports.isBotOwner = isBotOwner;
exports.isBotOwnerOrGuildOwner = isBotOwnerOrGuildOwner;
exports.isBotOwnerOrGuildOwnerSync = isBotOwnerOrGuildOwnerSync;
let cachedOwnerIds = null;
/**
 * ⚡ فحص متزامن: هل المستخدم مالك/مطوّر البوت؟
 * يفحص OWNER_ID وDEVELOPER_USER_ID، وأيضاً مالك التطبيق المخزّن بعد الإقلاع.
 * لا يحتاج client ولا اتصالاً بديسكورد وقت الاستدعاء.
 */
function isEnvBotOwner(userId) {
    if (!userId)
        return false;
    const id = String(userId).trim();
    if (!id)
        return false;
    const ids = [
        process.env.OWNER_ID,
        process.env.DEVELOPER_USER_ID,
        ...(cachedOwnerIds ?? []),
    ];
    return ids
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .some((ownerId) => ownerId === id);
}
function collectOwnerIds(owner) {
    if (!owner)
        return [];
    if ('members' in owner) {
        return [owner.ownerId, ...Array.from(owner.members.values()).map((m) => m.user.id)].filter((v) => !!v);
    }
    return [owner.id];
}
async function getBotOwnerIds(client) {
    const ids = new Set();
    if (process.env.OWNER_ID)
        ids.add(process.env.OWNER_ID);
    if (process.env.DEVELOPER_USER_ID)
        ids.add(process.env.DEVELOPER_USER_ID);
    if (cachedOwnerIds)
        cachedOwnerIds.forEach((id) => ids.add(id));
    else if (client.application) {
        let owner = client.application.owner;
        if (!owner) {
            try {
                owner = (await client.application.fetch()).owner;
            }
            catch { }
        }
        cachedOwnerIds = collectOwnerIds(owner);
        cachedOwnerIds.forEach((id) => ids.add(id));
    }
    return Array.from(ids);
}
async function isBotOwner(client, userId) {
    return (await getBotOwnerIds(client)).includes(userId);
}
/**
 * 👑 مالك/مطوّر البوت أو مالك السيرفر — البوابة الموحّدة للصلاحيات الإدارية العليا.
 * تُستخدم حيث يجب أن يتصرف المطوّر تماماً مثل صاحب السيرفر حتى بدون ملكية.
 */
async function isBotOwnerOrGuildOwner(client, guild, userId) {
    if (!userId)
        return false;
    if (guild && String(guild.ownerId) === String(userId))
        return true;
    return isBotOwner(client, userId);
}
/** نسخة متزامنة تعتمد على البيئة فقط + مالك السيرفر (للدوال غير async) */
function isBotOwnerOrGuildOwnerSync(guild, userId) {
    if (!userId)
        return false;
    if (guild && String(guild.ownerId) === String(userId))
        return true;
    return isEnvBotOwner(userId);
}
//# sourceMappingURL=botOwner.js.map