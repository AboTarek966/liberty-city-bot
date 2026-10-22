"use strict";
// ============================================
// Liberty City Bot - Alias Cache (ذاكرة اختصارات الأوامر)
// تمنع استعلام MongoDB في كل رسالة — تحميل كامل اختصارات
// السيرفر مرة واحدة كل 30 ثانية + إلغاء فوري عند الإضافة/الحذف
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAliasesForShortcut = getAliasesForShortcut;
exports.invalidateAliasCache = invalidateAliasCache;
exports.getAllGuildAliases = getAllGuildAliases;
const CommandAlias_1 = require("../models/CommandAlias");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('AliasCache');
const TTL = 30_000; // 30 ثانية
const cache = new Map();
// كل الاختصارات في السيرفر (alias → قائمة أوامر مرتبطة به)
async function loadGuildAliases(guildId) {
    const docs = await CommandAlias_1.CommandAlias.find({ guildId }).catch(() => []);
    const map = new Map();
    for (const doc of docs) {
        const list = map.get(doc.alias) || [];
        list.push(doc);
        map.set(doc.alias, list);
    }
    return map;
}
/**
 * جلب الأوامر المرتبطة باختصار معين.
 * نفس الاختصار قد يرتبط بأكثر من أمر (نظام التبديل/Toggle).
 */
async function getAliasesForShortcut(guildId, shortcut) {
    let entry = cache.get(guildId);
    if (!entry || Date.now() - entry.ts > TTL) {
        try {
            const map = await loadGuildAliases(guildId);
            entry = { map, ts: Date.now() };
            cache.set(guildId, entry);
        }
        catch (e) {
            logger.warn(`Alias cache load failed for ${guildId}: ${e.message}`);
            return [];
        }
    }
    return entry.map.get(shortcut) || [];
}
// إلغاء الذاكرة المؤقتة لسيرفر (يُستدعى عند الإضافة/الحذف)
function invalidateAliasCache(guildId) {
    if (guildId)
        cache.delete(guildId);
    else
        cache.clear();
}
/**
 * كل اختصارات السيرفر في خريطة واحدة (alias → أوامر).
 * تُستخدم لمطابقة اختصارات متعددة الكلمات (تحتوي مسافات).
 */
async function getAllGuildAliases(guildId) {
    let entry = cache.get(guildId);
    if (!entry || Date.now() - entry.ts > TTL) {
        try {
            const map = await loadGuildAliases(guildId);
            entry = { map, ts: Date.now() };
            cache.set(guildId, entry);
        }
        catch (e) {
            logger.warn(`Alias cache load failed for ${guildId}: ${e.message}`);
            return new Map();
        }
    }
    return entry.map;
}
//# sourceMappingURL=aliasCache.js.map