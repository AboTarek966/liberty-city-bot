"use strict";
// ============================================
// Liberty City Bot - AFK System (وضع عدم الوجود)
// - /afk [السبب] يفعّل AFK (أو يلغيه إذا كنت AFK)
// - أول رسالة لك تُلغي AFK تلقائياً + رسالة عودة
// - من يmention شخصاً في AFK يخبره البوت بالسبب
// ذاكرة مؤقتة سريعة حتى لا تُبطئ معالجة كل رسالة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAFK = getAFK;
exports.setAFK = setAFK;
exports.removeAFK = removeAFK;
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('AFK');
const TTL = 30_000; // 30 ثانية
const cache = new Map();
const keyOf = (guildId, userId) => `${guildId}:${userId}`;
function cleanup() {
    const now = Date.now();
    for (const [k, v] of cache) {
        if (now - v.ts > TTL)
            cache.delete(k);
    }
}
// جلب حالة AFK (مع ذاكرة مؤقتة)
async function getAFK(guildId, userId) {
    cleanup();
    const k = keyOf(guildId, userId);
    const hit = cache.get(k);
    if (hit && Date.now() - hit.ts < TTL)
        return hit.entry;
    let entry = null;
    try {
        const doc = await models_1.UserAFK.findOne({ guildId, userId }).lean();
        if (doc)
            entry = { reason: doc.reason || 'AFK', since: new Date(doc.since).getTime() };
    }
    catch (e) {
        logger.warn(`getAFK failed: ${e.message}`);
    }
    cache.set(k, { entry, ts: Date.now() });
    return entry;
}
// تفعيل AFK
async function setAFK(guildId, userId, reason) {
    const entry = { reason: reason || 'AFK', since: Date.now() };
    await models_1.UserAFK.updateOne({ guildId, userId }, { $set: { reason: entry.reason, since: new Date(entry.since) } }, { upsert: true }).catch(e => logger.warn(`setAFK failed: ${e.message}`));
    cache.set(keyOf(guildId, userId), { entry, ts: Date.now() });
    return entry;
}
// إلغاء AFK
async function removeAFK(guildId, userId) {
    cache.set(keyOf(guildId, userId), { entry: null, ts: Date.now() });
    try {
        const res = await models_1.UserAFK.deleteOne({ guildId, userId });
        return (res.deletedCount || 0) > 0;
    }
    catch (e) {
        logger.warn(`removeAFK failed: ${e.message}`);
        return false;
    }
}
//# sourceMappingURL=afk.js.map