"use strict";
// ============================================
// Omni Bot - Auto Reply (صورة/كلمة في قنوات محددة)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAutoReply = handleAutoReply;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const autoReplyImage_1 = require("./autoReplyImage");
/** ⏱️ آخر رد لكل (سيرفر/قناة/عضو) — يمنع السبام عند الرسائل السريعة */
const lastSent = new Map();
function pruneCooldowns(now) {
    if (lastSent.size < 4000)
        return;
    for (const [key, at] of lastSent) {
        if (now - at > 6 * 60 * 60 * 1000)
            lastSent.delete(key);
    }
}
/**
 * 💬 إذا كانت القناة ضمن قنوات الرد التلقائي، يرسل النص/الصورة المحددين.
 * @returns true إذا أرسل البوت الرد (حتى يتوقف باقي المعالجة)
 */
async function handleAutoReply(message) {
    if (!message.guild || message.author.bot || message.webhookId)
        return false;
    if (!('send' in message.channel))
        return false;
    const settings = await (0, models_1.getGuildSettings)(message.guild.id);
    const cfg = settings.autoReply;
    if (!cfg?.enabled)
        return false;
    const channelIds = Array.isArray(cfg.channelIds) ? cfg.channelIds : [];
    if (!channelIds.includes(message.channel.id))
        return false;
    const text = String(cfg.text || '').trim();
    const imageUrl = String(cfg.imageUrl || '').trim();
    // 🖼️ الصورة المرفوعة من الجهاز لها أولوية على الرابط
    const deviceImage = (0, autoReplyImage_1.getAutoReplyImageBuffer)(cfg);
    if (!text && !deviceImage && !imageUrl)
        return false;
    // 🛡️ تجاهل الإداريين (اختياري — مفعّل افتراضياً)
    if (cfg.ignoreStaff !== false && message.member) {
        const perms = message.member.permissions;
        if (perms.has(discord_js_1.PermissionFlagsBits.Administrator) || perms.has(discord_js_1.PermissionFlagsBits.ManageMessages)) {
            return false;
        }
    }
    // ⏱️ فاصل زمني لكل عضو في نفس القناة
    const cooldownMs = Math.max(0, Number(cfg.cooldownSeconds ?? 30)) * 1000;
    if (cooldownMs > 0) {
        const key = `${message.guild.id}:${message.channel.id}:${message.author.id}`;
        const now = Date.now();
        const last = lastSent.get(key) || 0;
        if (now - last < cooldownMs)
            return false;
        lastSent.set(key, now);
        pruneCooldowns(now);
    }
    // 🖼️ بناء الرد — صورة من الجهاز + نص، أو رابط صورة، أو نص فقط
    let payload;
    if (deviceImage) {
        const attachmentName = (0, autoReplyImage_1.autoReplyAttachmentName)(String(cfg.imageMimeType || 'image/jpeg'));
        const embed = new discord_js_1.EmbedBuilder().setImage(`attachment://${attachmentName}`).setColor(0x2b2d31);
        if (text)
            embed.setDescription(text);
        payload = {
            embeds: [embed],
            files: [new discord_js_1.AttachmentBuilder(deviceImage, { name: attachmentName })],
        };
    }
    else if (imageUrl) {
        const embed = new discord_js_1.EmbedBuilder().setImage(imageUrl).setColor(0x2b2d31);
        if (text)
            embed.setDescription(text);
        payload = { embeds: [embed] };
    }
    else {
        payload = { content: text };
    }
    try {
        if (cfg.replyToMessage !== false) {
            await message.reply(payload);
        }
        else {
            await message.channel.send(payload);
        }
        // 🗑️ حذف رسالة العضو بعد الرد (اختياري)
        if (cfg.deleteTrigger) {
            await message.delete().catch(() => { });
        }
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=autoReply.js.map