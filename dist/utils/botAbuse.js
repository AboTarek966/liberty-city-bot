"use strict";
// ============================================
// Omni Bot - Anti Bot Abuse
// ============================================
// الإساءة إلى البوت → تحذير → سحب كل الرولات القابلة للإزالة → حظر
// (مفعّل افتراضياً مع إمكانية الإطفاء من لوحة الحماية)
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBotAbuse = handleBotAbuse;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const BotAbuseStrike_1 = require("../models/BotAbuseStrike");
const helpers_1 = require("./helpers");
const securityAlerts_1 = require("./securityAlerts");
const logger = (0, helpers_1.createLogger)('AntiBotAbuse');
// 🧠 قائمة أساسية للإساءة (عربية + إنجليزية) — تستهدف البوت حصراً
const INSULT_WORDS = [
    // عربي — شتائم وإساءات شائعة (صريحة فقط)
    'كلب', 'حيوان', 'حمار', 'عاهر', 'عاهرة', 'قحبة', 'خول', 'عرص', 'حقير', 'قذر', 'تافه', 'غبي', 'فاشل',
    'نصاب', 'احتيال', 'نصب', 'شرموطة', 'شرموط', 'خرا', 'عاهة', 'عاهات', 'خسيس', 'قبيح', 'زق',
    'scam', 'scammer', 'fraud', 'fake', 'rip off',
    // إنجليزي
    'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'dick', 'stupid', 'idiot', 'dumb', 'worst', 'terrible',
    'useless', 'annoying', 'kys', 'trash', 'garbage', 'wtf', 'whore', 'slut',
    'go die', 'kill yourself', 'fuck you', 'fuck off', 'go to hell',
];
function normalize(s) {
    return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
const BOT_NAME_PATTERN = /(^|\s)(بوت|البوت|يا\s?بوت|bot|the\s?bot|omni|ليبرتي|liber(ty|ti))(\s|$)/iu;
function targetsBot(message, client) {
    const meId = client.user?.id;
    if (meId && message.mentions?.users?.has(meId))
        return true;
    if (meId && message.mentions?.members?.has(meId))
        return true;
    // ردّ مباشر على رسالة البوت
    if (meId && message.reference?.messageId) {
        const replied = message.mentions?.repliedUser;
        if (replied?.id === meId)
            return true;
    }
    // إشارة/اسم البوت داخل الرسالة (بحدود كلمة — لا يطابق "both" أو "robot")
    const content = normalize(message.content || '');
    return BOT_NAME_PATTERN.test(content);
}
/** مقارنة على مستوى الكلمة — تتجنّب مطابقة "نصب" داخل "نصبر" أو "bot" داخل "both" */
function hasAbuse(text) {
    const t = normalize(text);
    const tokens = t.split(' ').filter(Boolean);
    return INSULT_WORDS.some((w) => {
        if (w.includes(' '))
            return t.includes(w);
        if (/^[a-z ]+$/i.test(w)) {
            return tokens.some((tok) => tok === w || tok === `${w}s`);
        }
        return tokens.some((tok) => tok === w || tok === `ال${w}` || tok === `${w}ة`);
    });
}
/**
 * يعالج الإساءة المستهدفة للبوت.
 * @returns true إذا تم اعتبار الرسالة إساءة وتم التعامل معها (يجب إيقاف باقي المعالجة)
 */
async function handleBotAbuse(message) {
    if (!message.guild || message.author.bot)
        return false;
    try {
        const settings = await (0, models_1.getGuildSettings)(message.guild.id);
        // 🔓 لا يشترط تفعيل الذكاء العام — التحليل محلي (قاموس + تحليل أسلوب)
        const anti = settings.protection?.antiBotAbuse;
        if (!anti?.enabled)
            return false;
        const client = message.client;
        const guild = message.guild;
        const botMember = guild.members.me;
        if (!botMember)
            return false;
        // 🛡️ استثناء المالك + الأدمن فقط
        const member = guild.members.cache.get(message.author.id)
            || (await guild.members.fetch(message.author.id).catch(() => null));
        if (!member)
            return false;
        if (member.id === guild.ownerId)
            return false;
        if (member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
            return false;
        // رتبة العضو يجب أن تكون أقل من رتبة البوت (وإلا لا يمكن التصرف)
        if (member.roles.highest && botMember.roles.highest.position <= member.roles.highest.position)
            return false;
        // هل الرسالة تستهدف البوت فعلاً؟
        if (!targetsBot(message, client))
            return false;
        if (!hasAbuse(message.content || ''))
            return false;
        // حذف الرسالة (إن أمكن)
        if (message.deletable) {
            await message.delete().catch(() => { });
        }
        // تحديث العدّاد
        const strike = await BotAbuseStrike_1.BotAbuseStrike.findOneAndUpdate({ guildId: guild.id, userId: member.id }, { $inc: { count: 1 }, $set: { lastStrikeAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        const count = strike?.count ?? 1;
        const logId = settings.protection?.logChannel
            || settings.logging?.channelId
            || undefined;
        const logChannel = logId ? guild.channels.cache.get(logId) : undefined;
        const sendLog = async (action) => {
            if ((0, securityAlerts_1.securityAlertsSilent)(settings))
                return;
            if (!logChannel || !logChannel.isTextBased())
                return;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 مكافحة الإساءة للبوت')
                .setColor(0xed4245)
                .addFields({ name: '👤 العضو', value: `${member} \`${member.id}\``, inline: true }, { name: '🔢 عدد الإساءات', value: `${count}`, inline: true }, { name: '⚙️ الإجراء', value: action, inline: true }, { name: '📝 الرسالة', value: (message.content || '(فارغة)').slice(0, 1024), inline: false })
                .setFooter({ text: `${guild.name} • Anti Bot Abuse` })
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => { });
        };
        // 1️⃣ تحذير لفظي
        if (count === 1) {
            await message.channel.send({
                content: `⚠️ ${member} هذه إساءة للبوت — مرة واحدة فقط مسموحة. إذا كررتها ستُسحب رولاتك. في المرة الثالثة يتم الحظر.`,
            }).catch(() => { });
            await sendLog('تحذير لفظي');
            return true;
        }
        // 2️⃣ سحب كل الرولات القابلة للإزالة
        if (count === 2) {
            const meHighest = botMember.roles.highest.position;
            const removable = member.roles.cache.filter((r) => r.id !== guild.id && r.position < meHighest && r.editable);
            const removedNames = [];
            for (const role of removable.values()) {
                const ok = await member.roles.remove(role, 'إساءة متكررة للبوت').catch(() => null);
                if (ok)
                    removedNames.push(role.name);
            }
            await message.channel.send({
                content: `🚫 ${member} سحبت رولاتك بسبب الإساءة المتكررة للبوت. المرة القادمة = حظر.`,
            }).catch(() => { });
            await sendLog(`سحب ${removedNames.length} رول: ${removedNames.join('، ') || 'لا توجد رولات قابلة للإزالة'}`);
            return true;
        }
        // 3️⃣ حظر
        if (count >= 3) {
            await member.ban({ reason: 'إساءة متكررة للبوت (3 مرات)', deleteMessageSeconds: 604800 }).catch(() => { });
            await sendLog('حظر');
            return true;
        }
        return true;
    }
    catch (error) {
        logger.warn(`AntiBotAbuse failed: ${error.message}`);
        return false;
    }
}
//# sourceMappingURL=botAbuse.js.map