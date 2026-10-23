"use strict";
// ============================================
// Liberty City Bot - 👑 تحقق من ملكية البوت
// يحدد المالك تلقائياً من بيئة العمل أو من مالك التطبيق في Discord
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBotOwnerIds = getBotOwnerIds;
exports.isBotOwner = isBotOwner;
let cachedOwnerIds = null;
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
//# sourceMappingURL=botOwner.js.map