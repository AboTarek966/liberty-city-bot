"use strict";
// ============================================
// Omni Bot - أنظمة الرسائل المشتركة
// الأوامر المخصصة + نشاط التذاكر + الرصيد العشوائي
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApplicationIntent = isApplicationIntent;
exports.handleApplicationIntent = handleApplicationIntent;
exports.handleCustomCommand = handleCustomCommand;
exports.touchTicketActivity = touchTicketActivity;
exports.earnCreditsRandom = earnCreditsRandom;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const emoji_1 = require("./emoji");
const embeds_1 = require("./embeds");
const logger = (0, helpers_1.createLogger)('MessageSystems');
// --------------------------------------------
// 📝 التقديم على الإدارة — كشف صيغ "أريد التقديم" ويرسل نموذج التقديم داخل التذكرة المفتوحة فقط
// الأعضاء العاديون: لازم يفتحوا تذكرة أولاً؛ داخلها البوت يرسل نموذج التقديم + رسالة انتظار القبول/الرفض
// يعمل مع "أريد/عايز/أبغى أقدم على الإدارة" مهما كانت الصياغة، ومنها "تقديم اداره" نفسها
// --------------------------------------------
const APPLY_SUBMIT = /(?:أقدم|اقدم|التقدم|تقديم|تقدّم|ترشيح|أرشح|ارشح|أنضم|انضم|التحق|ابقدم|اقدم)/i;
const APPLY_TARGET = /(?:إدار|ادار|ادارة|اداره|إدا|أدم|ادم|أدمن|ادمن|مشرف|مشرفي|support|admin|moderator|فريق الإدارة|فريق الاداره)/i;
/** هل هذه رسالة طلب تقديم على الإدارة؟ */
function isApplicationIntent(content) {
    if (!content)
        return false;
    const text = (0, emoji_1.normalizeEmojiForMatch)(content).slice(0, 300);
    return APPLY_SUBMIT.test(text) && APPLY_TARGET.test(text);
}
/** يجد أمر التقديم على الإدارة في الأوامر المخصصة (إن وُجد) */
function findApplicationCommand(commands) {
    if (!Array.isArray(commands) || !commands.length)
        return null;
    const isApp = (n) => /(تقديم|تقدم|ترشيح|ارشح|أقدم|اقدم)/i.test(n) &&
        /(إدار|ادار|ادارة|اداره|إدا|أدم|ادم|أدمن|ادمن|مشرف)/i.test(n);
    // الأفضل مطابقة الاسم الأقرب "تقديم اداره" أولاً
    const preferred = commands.find(c => /تقديم/.test((0, emoji_1.normalizeEmojiForMatch)(String(c.name || ''))) && /(اداره|إدارة|ادارة)/i.test(String(c.name || '')));
    if (preferred)
        return preferred;
    return commands.find(c => isApp((0, emoji_1.normalizeEmojiForMatch)(String(c.name || '')))) || null;
}
async function handleApplicationIntent(message) {
    if (!message.guild || !message.member || message.author.bot)
        return false;
    if (!isApplicationIntent(message.content || ''))
        return false;
    const settings = await (0, models_1.getGuildSettings)(message.guild.id);
    const appCmd = findApplicationCommand(settings.customCommands || []);
    // لا يوجد أمر تقديم معرّف → لا نتدخل (رسائل التقديم العادية تمر للذكاء الاصطناعي)
    if (!appCmd)
        return false;
    // هل الرسالة داخل تذكرة مفتوحة يمتلكها العضو؟
    const ticketInChannel = await models_1.Ticket.findOne({
        guildId: message.guild.id,
        channelId: message.channel.id,
        status: { $in: ['open', 'claimed', 'waiting'] },
    }).lean().catch(() => null);
    if (ticketInChannel && String(ticketInChannel.userId) === message.author.id) {
        // داخل تذكرة العضو → أرسل نموذج التقديم + رسالة الانتظار
        const form = String(appCmd.content || '')
            .replace(/\{user\}/g, `<@${message.author.id}>`)
            .replace(/\{server\}/g, message.guild.name);
        appCmd.uses = (appCmd.uses || 0) + 1;
        await settings.save?.().catch(() => { });
        const adminRoles = settings.tickets?.adminRoleIds?.length
            ? settings.tickets.adminRoleIds
            : settings.tickets?.supportRoleIds || [];
        const mention = adminRoles.map((r) => `<@&${r}>`).join(' ');
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📝 نموذج التقديم على الإدارة')
            .setColor(embeds_1.Colors.primary)
            .setDescription(`${(0, emoji_1.resolveEmojiShortcodes)(form.substring(0, 3800), message.guild)}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⏳ **انتظر الإدارة** — هيتم مراجعة طلبك والرد عليك داخل هذه التذكرة **بالقبول أو الرفض**.\n` +
            `📌 ما ترسلش الطلب أكثر من مرة، وأي استفسار اكتبه هنا وهيتشاف.`)
            .setFooter({ text: `${message.guild.name} • طلب تقديم إدارة` })
            .setTimestamp();
        await message
            .reply({
            content: mention ? `${mention} — وصل طلب تقديم جديد 📥` : undefined,
            embeds: [embed],
            allowedMentions: { roles: adminRoles },
        })
            .catch(() => { });
        logger.info(`📝 طلب تقديم إدارة من ${message.author.tag} — أُرسل النموذج داخل التذكرة`);
        return true;
    }
    // خارج تذكرة → لازم يفتح تذكرة أولاً
    const openTicket = await models_1.Ticket.findOne({
        guildId: message.guild.id,
        userId: message.author.id,
        status: { $in: ['open', 'claimed', 'waiting'] },
    }).lean().catch(() => null);
    const openHint = openTicket?.channelId
        ? `🎫 عندك تذكرة مفتوحة: <#${openTicket.channelId}> — افتحها واكتب «أريد التقديم على الإدارة» وهنبعتلك النموذج هناك.`
        : '🎫 لازم تفتح **تذكرة أولاً** (زر فتح تذكرة / أمر التذاكر)، وبعدين اكتب «أريد التقديم على الإدارة» داخلها — وإحنا هنبعتلك نموذج التقديم وننتظر قبول أو رفض الإدارة.';
    await message
        .reply({
        content: `<@${message.author.id}>\n` +
            `📝 **التقديم على الإدارة يكون داخل تذكرة فقط**\n` +
            openHint,
    })
        .catch(() => { });
    return true;
}
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
    // 🎯 مطابقة موحدة للإيموجي — المحفّز يُكتب إيموجي عادي أو `<:اسم:id>` أو `:اسم:`،
    //    وكل الصيغ تُطابق بعضها (تُوحَّد بالاسم — الرقم غير مطلوب، و❤️ تطابق ❤ و👍 تطابق 👍🏽)
    const norm = (0, emoji_1.normalizeEmojiForMatch)(content);
    const firstWord = norm.split(/\s+/)[0];
    const cmd = commands.find(c => {
        const n = (0, emoji_1.normalizeEmojiForMatch)(c.name);
        return n === norm || n === firstWord;
    });
    if (!cmd)
        return false;
    // 🔒 أمر إداري — يرد فقط على حاملي صلاحية Administrator.
    //   نرجع `false` بصمت (بدون رسالة خطأ) حتى لا نكشف للعضو العادي وجود هذا الأمر أصلاً.
    if (cmd.scope === 'admin') {
        const member = message.member;
        if (!member?.permissions?.has?.(discord_js_1.PermissionFlagsBits.Administrator))
            return false;
    }
    const reply = cmd.content
        .replace(/\{user\}/g, `<@${message.author.id}>`)
        .replace(/\{server\}/g, message.guild.name);
    cmd.uses = (cmd.uses || 0) + 1;
    await settings.save().catch(() => { });
    // 🎨 تحويل اختصارات الإيموجي (:اسم:) — يُقصّ أولاً حتى لا يُقصّ إيموجي حديث في منتصفه
    await message.reply((0, emoji_1.resolveEmojiShortcodes)(reply.substring(0, 2000), message.guild)).catch(() => { });
    logger.info(`📝 الأمر المخصص "${cmd.name}" استُخدم بواسطة ${message.author.tag}`);
    return true;
}
// --------------------------------------------
// تحديث آخر نشاط في تذكرة مفتوحة (نظام الإغلاق التلقائي عند الخمول)
// يعيد ضبط علامة التحذير عند عودة النشاط
// ⚡ مع ذاكرة مؤقتة: القنوات العادية تُفحص مرة كل دقيقة فقط
// (بدل استعلام + كتابة في قاعدة البيانات مع كل رسالة!)
// --------------------------------------------
const ticketChannelCache = new Map();
const TICKET_NEG_TTL = 60_000; // قناة عادية → فحص كل دقيقة
const TICKET_POS_TTL = 300_000; // قناة تذكرة → فحص كل 5 دقائق
async function touchTicketActivity(message) {
    if (!message.guild)
        return;
    const channelId = message.channel.id;
    const now = Date.now();
    const hit = ticketChannelCache.get(channelId);
    let active;
    if (hit && now - hit.ts < (hit.active ? TICKET_POS_TTL : TICKET_NEG_TTL)) {
        active = hit.active;
    }
    else {
        try {
            const doc = await models_1.Ticket.findOne({
                channelId,
                status: { $in: ['open', 'claimed', 'waiting'] },
            })
                .select('_id')
                .lean();
            active = !!doc;
        }
        catch {
            active = false;
        }
        ticketChannelCache.set(channelId, { active, ts: now });
    }
    if (!active)
        return;
    await models_1.Ticket.updateOne({ channelId, status: { $in: ['open', 'claimed', 'waiting'] } }, { $set: { lastActivityAt: new Date(), idleWarned: false } }).exec();
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