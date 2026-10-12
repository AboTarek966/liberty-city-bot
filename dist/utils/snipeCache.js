"use strict";
// ============================================
// Liberty City Bot - Snipe Cache (سنايب)
// حفظ آخر الرسائل المحذوفة لكل قناة مؤقتاً (15 دقيقة)
// يُستخدم بأمر /snipe أو أي اختصار مضاف له
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordDeletedMessage = recordDeletedMessage;
exports.getSnipedMessage = getSnipedMessage;
exports.getSnipeCount = getSnipeCount;
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('Snipe');
const store = new Map(); // `${guildId}:${channelId}` → الأحدث أولاً
const TTL_MS = 15 * 60 * 1000; // 15 دقيقة
const MAX_PER_CHANNEL = 5; // آخر 5 رسائل لكل قناة
/** تسجيل رسالة محذوفة (يستدعيها حدث messageDelete) */
function recordDeletedMessage(message) {
    try {
        if (!message?.guild?.id || !message.channelId)
            return;
        const content = typeof message.content === 'string' ? message.content : '';
        const attachments = Array.from((message.attachments?.values?.() || []))
            .slice(0, 5)
            .map((a) => ({ name: a.name || 'مرفق', url: a.url }))
            .filter((a) => !!a.url);
        const embedCount = message.embeds?.size ?? (Array.isArray(message.embeds) ? message.embeds.length : 0);
        // لا شيء قابل للاسترجاع
        if (!content.trim() && attachments.length === 0 && !embedCount)
            return;
        const entry = {
            authorId: message.author?.id || '0',
            authorTag: message.author?.tag || message.author?.username || 'غير معروف',
            authorAvatar: message.author?.displayAvatarURL?.() || null,
            content: content.trim() || (attachments.length ? '' : ' *(رسالة بدون نص — إمبد)*'),
            embedCount,
            attachments,
            channelId: message.channelId,
            postedAt: message.createdTimestamp || Date.now(),
            deletedAt: Date.now(),
            pinned: !!message.pinned,
        };
        const key = `${message.guild.id}:${message.channelId}`;
        const list = (store.get(key) || []).filter(e => Date.now() - e.deletedAt < TTL_MS);
        list.unshift(entry);
        if (list.length > MAX_PER_CHANNEL)
            list.length = MAX_PER_CHANNEL;
        store.set(key, list);
        logger.debug(`Sniped deleted message in ${message.guild.id}/${message.channelId}`);
    }
    catch (error) {
        logger.warn('recordDeletedMessage failed:', error);
    }
}
/** جلب رسالة محذوفة — index=0 الأحدث (الأقدم حتى 4) */
function getSnipedMessage(guildId, channelId, index = 0) {
    const key = `${guildId}:${channelId}`;
    const list = (store.get(key) || []).filter(e => Date.now() - e.deletedAt < TTL_MS);
    if (list.length === 0)
        return null;
    store.set(key, list);
    return list[index] || null;
}
/** عدد الرسائل المحفوظة حالياً لهذه القناة */
function getSnipeCount(guildId, channelId) {
    const key = `${guildId}:${channelId}`;
    const list = (store.get(key) || []).filter(e => Date.now() - e.deletedAt < TTL_MS);
    store.set(key, list);
    return list.length;
}
//# sourceMappingURL=snipeCache.js.map