"use strict";
// ============================================
// Liberty City Bot - أنظمة الرسائل المشتركة
// الأوامر المخصصة + نشاط التذاكر + الرصيد العشوائي
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCustomCommand = handleCustomCommand;
exports.touchTicketActivity = touchTicketActivity;
exports.earnCreditsRandom = earnCreditsRandom;
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('MessageSystems');
// --------------------------------------------
// الأوامر المخصصة (ردود تلقائية لكلمات محددة)
// المطابقة: الكلمة الأولى من الرسالة أو الرسالة كاملة
// متغيرات الرد: {user} = منشن صاحب الرسالة، {server} = اسم السيرفر
// --------------------------------------------
async function handleCustomCommand(message) {
    if (!message.guild)
        return false;
    const content = message.content.trim().toLowerCase();
    if (!content || content.length > 100 || content.startsWith('<@'))
        return false;
    const settings = await (0, models_1.getGuildSettings)(message.guild.id);
    const commands = settings.customCommands;
    if (!commands || commands.length === 0)
        return false;
    const firstWord = content.split(/\s+/)[0];
    const cmd = commands.find(c => c.name.toLowerCase() === content) ||
        commands.find(c => c.name.toLowerCase() === firstWord);
    if (!cmd)
        return false;
    const reply = cmd.content
        .replace(/\{user\}/g, `<@${message.author.id}>`)
        .replace(/\{server\}/g, message.guild.name);
    cmd.uses = (cmd.uses || 0) + 1;
    await settings.save().catch(() => { });
    await message.reply(reply.substring(0, 2000)).catch(() => { });
    logger.info(`📝 الأمر المخصص "${cmd.name}" استُخدم بواسطة ${message.author.tag}`);
    return true;
}
// --------------------------------------------
// تحديث آخر نشاط في تذكرة مفتوحة (نظام الإغلاق التلقائي عند الخمول)
// يعيد ضبط علامة التحذير عند عودة النشاط
// --------------------------------------------
async function touchTicketActivity(message) {
    if (!message.guild)
        return;
    await models_1.Ticket.updateOne({ channelId: message.channel.id, status: { $in: ['open', 'claimed', 'waiting'] } }, { $set: { lastActivityAt: new Date(), idleWarned: false } }).exec();
}
// --------------------------------------------
// رصيد عشوائي أثناء التحدث: فرصة 25% لكل رسالة = +5 عملات
// (يشجع على تجميع الرصيد لشراء عناصر المتجر)
// --------------------------------------------
async function earnCreditsRandom(message) {
    if (!message.guild)
        return;
    if (Math.random() >= 0.25)
        return;
    await models_1.UserProfile.updateOne({ userId: message.author.id, guildId: message.guild.id }, { $inc: { balance: 5 } }, { upsert: true }).exec();
}
//# sourceMappingURL=messageSystems.js.map