"use strict";
// ============================================
// Omni Bot - Anti Bot Abuse
// ============================================
// الإساءة إلى البوت → حذف + تحذير → سحب الرتب القابلة للإزالة → حظر
// (مفعّل افتراضياً مع إمكانية الإطفاء من لوحة الحماية)
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBotAbuse = handleBotAbuse;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const BotAbuseStrike_1 = require("../models/BotAbuseStrike");
const helpers_1 = require("./helpers");
const securityAlerts_1 = require("./securityAlerts");
const abuseDetector_1 = require("./abuseDetector");
const botOwner_1 = require("./botOwner");
const logger = (0, helpers_1.createLogger)('AntiBotAbuse');
// 🤖 اسم البوت داخل الرسالة (بعد التطبيع)
const BOT_NAME_PATTERN = /(^|\s)(?:و|ف|ب)?(?:ال)?(?:يا)?(بوت|بوتك|بوتي|بوتنا|بوتكم|بوتات|bot|thebot|omni|اومني|ليبرتي|liberty|liberti|liber)(\s|$)/iu;
// أسماء لصيقة مثل OmniBot / LibertyBot (بدون كلمة bot منفصلة لتفادي robot)
const BOT_SUBSTRING_PATTERN = /omni|اومني|ليبرتي|liberty|liberti/i;
/** كلمات الحظر المخصّصة للسيرفر (تُعامل كإساءة إضافية) */
function getGuildBadWords(settings) {
    const words = settings?.automod?.badWords;
    return Array.isArray(words) ? words.filter((w) => typeof w === 'string' && w.trim()) : [];
}
/**
 * فحص سريع ورخيص: هل الرسالة موجهة للبوت أو تحتوي سباً صريحاً؟
 * (بدون أي استعلام قاعدة بيانات — لتخفيف الحمل على كل رسالة)
 */
async function targetsBotQuick(message, client) {
    const meId = client.user?.id;
    if (meId && message.mentions?.users?.has(meId))
        return true;
    if (meId && message.mentions?.members?.has(meId))
        return true;
    // ردّ مباشر على رسالة البوت (يشمل الحالات التي لا يُعبّأ فيها mentions.repliedUser)
    let repliedAuthorId;
    if (meId && message.reference?.messageId) {
        const replied = message.mentions?.repliedUser;
        if (replied?.id === meId)
            return true;
        try {
            const ref = await message.fetchReference();
            repliedAuthorId = ref?.author?.id;
            if (repliedAuthorId === meId)
                return true;
        }
        catch {
            /* تجاهل فشل جلب الرسالة المُشار إليها */
        }
    }
    // إشارة/اسم البوت داخل الرسالة
    const content = message.content || '';
    const normalized = (0, abuseDetector_1.normalizeArabic)(content);
    if (normalized) {
        if (BOT_NAME_PATTERN.test(normalized))
            return true;
        if (BOT_SUBSTRING_PATTERN.test(normalized))
            return true;
    }
    // الاسم الملتصق بحرف عربي (Omniبوت) قد يتشوّه بعد تطبيع الخلط — نفحص النص الخام أيضاً
    if (BOT_SUBSTRING_PATTERN.test(content.toLowerCase()))
        return true;
    // سب صريح بلا ذكر البوت — "يا ابن الكلب" وحدها لا تُقرأ كترحيب
    if (!(0, abuseDetector_1.containsHardSlur)(content))
        return false;
    // لو الرسالة موجهة لعضو آخر صراحةً (منشن/ردّ)، ليست إساءة للبوت
    if (message.mentions?.users?.size > 0)
        return false;
    if (meId && repliedAuthorId && repliedAuthorId !== meId)
        return false;
    return true;
}
/**
 * يعالج الإساءة المستهدفة للبوت.
 * @returns true إذا تم اعتبار الرسالة إساءة وتم التعامل معها (يجب إيقاف باقي المعالجة)
 */
async function handleBotAbuse(message) {
    if (!message.guild || message.author.bot)
        return false;
    const client = message.client;
    const guild = message.guild;
    const botMember = guild.members.me;
    if (!botMember)
        return false;
    // 🚦 لا نلمس قاعدة البيانات إلا إذا كانت الرسالة تخص البوت فعلاً
    if (!(await targetsBotQuick(message, client)))
        return false;
    try {
        // ⚙️ إعدادات السيرفر — لو فشل القراءة نكمل بالافتراضي (مفعّلة)
        let settings = null;
        try {
            settings = await (0, models_1.getGuildSettings)(guild.id);
        }
        catch (error) {
            logger.warn(`تعذر قراءة الإعدادات — سيتم استخدام الوضع الافتراضي: ${error?.message || error}`);
        }
        const anti = settings?.protection?.antiBotAbuse;
        if (anti && anti.enabled === false)
            return false;
        // 🛡️ استثناء المالك ومطوّر البوت فقط (Discord يمنع المساس بالمالك)
        if (message.author.id === guild.ownerId)
            return false;
        if ((0, botOwner_1.isEnvBotOwner)(message.author.id))
            return false;
        const member = message.member ||
            guild.members.cache.get(message.author.id) ||
            (await guild.members.fetch(message.author.id).catch(() => null));
        if (member && member.id === guild.ownerId)
            return false;
        const badWords = getGuildBadWords(settings);
        const abuse = (0, abuseDetector_1.findAbuse)(message.content || '', badWords);
        if (!abuse) {
            // 🔍 تشخيص: رسالة موجّهة للبوت ولم تُصنّف إساءة — نسجّل النص لاكتشاف الكلمات الناقصة
            logger.debug(`AntiBotAbuse: رسالة للبوت خارج القاموس | ${message.author.tag} | "${(message.content || '').slice(0, 180)}"`);
            return false;
        }
        logger.info(`AntiBotAbuse: مطابقة «${abuse.term}» (${abuse.kind}) | ${message.author.tag} | ${abuse.normalized}`);
        // 🚦 التصعيد (سحب رتب/حظر) يحتاج رتبة البوت أعلى من رتبة العضو.
        //    الحذف والتحذير يعملان دائماً — حتى لو كانت رتبته أعلى.
        const canEscalate = !!member &&
            (!member.roles.highest || botMember.roles.highest.position > member.roles.highest.position);
        const display = member ? `${member}` : `${message.author}`;
        const ownerRoleName = member?.roles?.highest?.name;
        // ============================================
        // من هنا بدأت الإساءة فعلاً — لا نسمح أبداً بمرور رسالة ترحيب
        // ============================================
        try {
            // 0️⃣ حذف الرسالة
            if (message.deletable) {
                const deleted = await message.delete().then(() => true).catch((error) => {
                    logger.warn(`تعذر حذف رسالة الإساءة: ${error?.message || error}`);
                    return false;
                });
                if (!deleted) {
                    logger.warn(`AntiBotAbuse: فشل حذف رسالة ${message.author.tag} — تأكد من صلاحية Manage Messages`);
                }
            }
            // 1️⃣ تحديث العدّاد (لو فشلت قاعدة البيانات نكمل بتحذير على الأقل)
            let count = 1;
            try {
                const STRIKE_DECAY_MS = 7 * 24 * 60 * 60 * 1000; // تُصفّر العدّادات القديمة بعد أسبوع
                const existing = await BotAbuseStrike_1.BotAbuseStrike.findOne({
                    guildId: guild.id,
                    userId: message.author.id,
                }).lean();
                const stale = !!existing &&
                    Date.now() - new Date(existing.lastStrikeAt).getTime() > STRIKE_DECAY_MS;
                const strike = await BotAbuseStrike_1.BotAbuseStrike.findOneAndUpdate({ guildId: guild.id, userId: message.author.id }, stale
                    ? { $set: { count: 1, lastStrikeAt: new Date() } }
                    : { $inc: { count: 1 }, $set: { lastStrikeAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true });
                count = strike?.count ?? 1;
            }
            catch (error) {
                logger.warn(`تعذر تحديث عدّاد الإساءات (سيُحتسب تحذير): ${error?.message || error}`);
            }
            const logId = settings?.protection?.logChannel || settings?.logging?.channelId || undefined;
            const logChannel = logId
                ? guild.channels.cache.get(logId)
                : undefined;
            const sendLog = async (action) => {
                if ((0, securityAlerts_1.securityAlertsSilent)(settings))
                    return;
                if (!logChannel || !logChannel.isTextBased())
                    return;
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🤖 مكافحة الإساءة للبوت')
                    .setColor(0xed4245)
                    .addFields({ name: '👤 العضو', value: `${display} \`${message.author.id}\``, inline: true }, { name: '🔢 عدد الإساءات', value: `${count}`, inline: true }, { name: '⚙️ الإجراء', value: action, inline: true }, { name: '🔎 الكلمة المطابقة', value: `\`${abuse.term}\` • ${abuse.kind}`, inline: false }, { name: '📝 الرسالة', value: (message.content || '(فارغة)').slice(0, 1024), inline: false })
                    .setFooter({ text: `${guild.name} • Anti Bot Abuse` })
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] }).catch(() => { });
            };
            // 2️⃣ تحذير لفظي (أول إساءة)
            if (count === 1) {
                const escalationHint = canEscalate
                    ? 'إذا كررتها ستُسحب رولاتك. في المرة الثالثة يتم الحظر.'
                    : ownerRoleName
                        ? `لا أستطيع سحب رولاتك أو حظرك لأن رولك «${ownerRoleName}» أعلى من رول البوت — رتّب رول البوت أعلى لحماية كاملة.`
                        : 'تعذر الوصول إلى بيانات عضويتك، لذلك لن أستطيع سحب الرولات أو الحظر حالياً.';
                await message.channel
                    .send({
                    content: `⚠️ ${display} هذه إساءة للبوت — ممنوع. ${escalationHint}`,
                })
                    .catch(() => { });
                await sendLog('حذف + تحذير');
                return true;
            }
            // 3️⃣ سحب كل الرتب القابلة للإزالة (ثاني إساءة)
            if (count === 2) {
                if (!canEscalate || !member) {
                    await message.channel
                        .send({
                        content: `⚠️ ${display} تم تسجيل إساءة جديدة للبوت (${count}). ${ownerRoleName
                            ? `رولك «${ownerRoleName}» أعلى من رول البوت، لذلك لا أستطيع سحب الرولات أو الحظر — رتّب رول البوت أعلى لحماية كاملة.`
                            : 'تعذر الوصول إلى بيانات عضويتك، لذلك لا أستطيع سحب الرولات أو الحظر حالياً.'}`,
                    })
                        .catch(() => { });
                    await sendLog(ownerRoleName
                        ? `تعذر التصعيد — رول العضو «${ownerRoleName}» أعلى من رول البوت`
                        : 'تعذر التصعيد — تعذر جلب العضو');
                    return true;
                }
                const meHighest = botMember.roles.highest.position;
                const removable = member.roles.cache.filter((r) => r.id !== guild.id && r.position < meHighest && r.editable);
                const removedNames = [];
                for (const role of removable.values()) {
                    const ok = await member.roles.remove(role, 'إساءة متكررة للبوت').catch(() => null);
                    if (ok)
                        removedNames.push(role.name);
                }
                await message.channel
                    .send({
                    content: `🚫 ${display} سحبت رولاتك بسبب الإساءة المتكررة للبوت. المرة القادمة = حظر.`,
                })
                    .catch(() => { });
                await sendLog(`سحب ${removedNames.length} رول: ${removedNames.join('، ') || 'لا توجد رولات قابلة للإزالة'}`);
                return true;
            }
            // 4️⃣ حظر (ثالث إساءة)
            if (count >= 3) {
                if (!canEscalate || !member) {
                    await message.channel
                        .send({
                        content: `⚠️ ${display} تم تسجيل إساءة جديدة للبوت (${count}). ${ownerRoleName
                            ? `رولك «${ownerRoleName}» أعلى من رول البوت، لذلك لا أستطيع الحظر — رتّب رول البوت أعلى لحماية كاملة.`
                            : 'تعذر الوصول إلى بيانات عضويتك، لذلك لا أستطيع الحظر حالياً.'}`,
                    })
                        .catch(() => { });
                    await sendLog(ownerRoleName
                        ? `تعذر الحظر — رول العضو «${ownerRoleName}» أعلى من رول البوت`
                        : 'تعذر الحظر — تعذر جلب العضو');
                    return true;
                }
                const banned = await member
                    .ban({ reason: 'إساءة متكررة للبوت (3 مرات)', deleteMessageSeconds: 604800 })
                    .then(() => true)
                    .catch((error) => {
                    logger.warn(`تعذر حظر ${message.author.tag}: ${error?.message || error}`);
                    return false;
                });
                await sendLog(banned ? 'حظر' : 'تعذر الحظر — راجع صلاحيات البوت');
                return true;
            }
            return true;
        }
        catch (error) {
            // حتى لو فشل الحذف/العقوبة، الرسالة إساءة مؤكدة: لا نمررها للذكاء الاصطناعي
            logger.warn(`AntiBotAbuse punishment failed: ${error?.message || error}`);
            return true;
        }
    }
    catch (error) {
        logger.warn(`AntiBotAbuse failed: ${error?.message || error}`);
        return false;
    }
}
//# sourceMappingURL=botAbuse.js.map