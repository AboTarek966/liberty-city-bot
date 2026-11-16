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
const badWords_1 = require("./badWords");
const securityAlerts_1 = require("./securityAlerts");
const logger = (0, helpers_1.createLogger)('AntiBotAbuse');
// 🧠 قائمة أساسية للإساءة (عربية + إنجليزية) — شاملة قدر الإمكان للبوت
// ملاحظة: الكشف يعتمد تطابق الكلمات/العبارات بعد التطبيع مع معالجة "يا/ال" والتكرار،
// وليس مجرد وجود الكلمة في AutoMod.
const INSULT_WORDS = [
    // شتائم/إهانات عربية شائعة (فصحى/عامية)
    'كلب', 'يا كلب', 'حيوان', 'يا حيوان', 'حمار', 'يا حمار', 'بغل', 'جحش', 'بقره', 'بقرة', 'خنزير', 'قرد',
    'غبي', 'غبى', 'غبيه', 'اغبى', 'اهبل', 'هبل', 'هبي', 'متخلف', 'متخلفة', 'معتوه', 'معتوهه', 'معوق', 'منغولي',
    'عبيط', 'عبيطه', 'ابله', 'ابله', 'تافه', 'تافهه', 'سخيف', 'سخيفه', 'فاشل', 'فاشله', 'فاشلين', 'بائس', 'تعيس',
    'حقير', 'حقيره', 'قذر', 'قذره', 'وسخ', 'وسخه', 'معفن', 'معفنه', 'قبيح', 'قبيحه', 'مقرف', 'مقرفه', 'مقزز',
    'خسيس', 'خسيسه', 'دني', 'دنيء', 'سافل', 'سافله', 'وضيع', 'منحط', 'صايع', 'هامل', 'عديم', 'تافه اوي',
    'زباله', 'زبالة', 'قمامه', 'قمامة', 'كوم زباله', 'زفت', 'خرا', 'خره', 'خراي', 'زق', 'زب', 'طيز', 'عرصه',
    'نصاب', 'نصابين', 'حرامي', 'سارق', 'محتال', 'احتيال', 'نصب', 'خداع', 'كداب', 'كذاب', 'كدابه',
    'مزعج', 'ممل', 'غثيث', 'تافه', 'عديم الفائده', 'عديم الفائدة', 'مالوش لازمه', 'ماله لازمه', 'ولا تسوى', 'ما تسوى',
    'ضعيف', 'هزيل', 'مهرج', 'مسخره', 'مسخرة', 'هزء', 'سخيف', 'مريض', 'مجنون',
    // ألفاظ بذيئة/شتائم مركبة شائعة
    'عاهر', 'عاهرة', 'قحبة', 'قحبه', 'قحاب', 'شرموطة', 'شرموطه', 'شرموط', 'شاذ', 'شاذه',
    'خول', 'عرص', 'معرص', 'ديوث', 'ديوس', 'قواد', 'قواده', 'لبوه', 'لبوة',
    'متناك', 'متناكه', 'منيوك', 'منيوكه', 'منايك', 'منيك', 'منيكه', 'انيك', 'نيك', 'ناك', 'زاني', 'زانية', 'فاجر', 'فاجرة',
    'كسمك', 'كس امك', 'كس اختك', 'كس اخوك', 'كس ابوك', 'كس امكم', 'كس ام', 'كسختك', 'كس اختكم',
    'يلعن امك', 'يلعن ابوك', 'يلعن شكلك', 'يلعن ابو امك', 'يلعن دينك', 'يلعنك', 'ملعون',
    'ابن الكلب', 'يابن الكلب', 'ابن العاهرة', 'يابن العاهرة', 'ابن الحرام', 'يابن الحرام', 'ابن الوسخة', 'ابن الوسخه',
    'ابن القحبة', 'ابن القحبه', 'ابن المتناكة', 'ابن المتناكه', 'ابن الشرموطة', 'ابن الشرموطه',
    'يا ابن الكلب', 'يا ابن الحرام', 'يا ابن العاهرة', 'يا ابن القحبة', 'يا ابن الشرموطة',
    'ولد الكلب', 'ولد الحرام', 'ولد القحبة', 'ولد الزنا',
    // إهانة/طرد/تهديد مباشر (عند توجيهها للبوت)
    'انقلع', 'اخرج', 'اطلع', 'اغرب', 'اختف', 'ابعد', 'اخرس', 'اسكت', 'اسكتي', 'سكته', 'سكوت',
    'روح موت', 'مت', 'اموت', 'اقتل نفسك', 'اذبح نفسك', 'انتحر', 'فكك', 'تعطل', 'اغلق', 'اطفي',
    'تفو', 'اتفو', 'اتفو عليك', 'عيب عليك', 'يا عيب الشوم',
    // إنجليزي
    'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'mf', 'shit', 'bullshit', 'shitty', 'crap',
    'bitch', 'ass', 'asshole', 'dick', 'dickhead', 'pussy', 'bastard', 'cunt', 'whore', 'slut', 'hoe',
    'jerk', 'moron', 'stupid', 'idiot', 'dumb', 'dumbass', 'retard', 'retarded', 'loser', 'pathetic', 'lame',
    'trash', 'garbage', 'useless', 'worthless', 'annoying', 'worst', 'terrible', 'horrible', 'awful',
    'suck', 'sucks', 'shut up', 'shutup', 'stfu', 'kys', 'kill yourself', 'die', 'go die',
    'fuck you', 'fuck off', 'fuck u', 'fuk you', 'fuk off', 'go to hell', 'piss off', 'wtf', 'wth',
    'scam', 'scammer', 'fraud', 'fake', 'ripoff', 'rip off', 'bot trash', 'trash bot', 'stupid bot', 'dumb bot',
];
function collapseRepeats(s) {
    // تقليل تكرار الحروف (غبييي -> غبيي/غبي تقريباً) لتحسين المطابقة بدون كسر المعنى كثيراً
    return s.replace(/(.)\1{2,}/gu, '$1$1');
}
function normalizeForAbuse(text) {
    return collapseRepeats((0, badWords_1.normalizeBadWord)(text));
}
const BOT_NAME_PATTERN = /(^|\s)(بوت|البوت|يا\s?بوت|bot|the\s?bot|omni|ليبرتي|liber(ty|ti))(\s|$)/iu;
// كابسة شاملة: يابوت / بوتك / بوتات / كل حرف ما بوت — رسالة عن البوت بغض النظر عن كتابة الحدود
const BOT_SUBSTRING_PATTERN = /بوت|omni|bot|liber(ty|ti)/i;
// إهانات مباشرة لا تجوز قراءتها كسلام — تُعتبر مستهدِفة البوت حتى لو ما ذكرته
// (بعد التطبيع: إزالة التتشكيل/الزخرفة وتوحيد الحروف). هدفنا رد "مرحبا" على سب صريح = خطأ.
const STANDALONE_INSULTS = [
    'كسمك', 'كس امك', 'كس اختك', 'كس اخوك', 'كس ابوك',
    'انيك', 'منيوك', 'منيوكه', 'منيك', 'نيك',
    'يا كلب', 'يا حمار', 'يا حيوان', 'يا عاهر', 'يا عاهرة', 'يا قحبة', 'يا شرموطة',
    'يا ابن الكلب', 'يا ابن الحرام', 'يا ابن العاهر', 'يا ابن القحبة',
    'متناك', 'متناكة', 'يا ابن المتناكة', 'يا ابن المتناكه',
];
async function targetsBot(message, client) {
    const meId = client.user?.id;
    if (meId && message.mentions?.users?.has(meId))
        return true;
    if (meId && message.mentions?.members?.has(meId))
        return true;
    // ردّ مباشر على رسالة البوت (يشمل الحالات التي لا يُعبّأ فيها mentions.repliedUser)
    if (meId && message.reference?.messageId) {
        const replied = message.mentions?.repliedUser;
        if (replied?.id === meId)
            return true;
        try {
            const ref = await message.fetchReference();
            if (ref?.author?.id === meId)
                return true;
        }
        catch {
            /* تجاهل فشل جلب الرسالة المُشار إليها */
        }
    }
    // إشارة/اسم البوت داخل الرسالة
    const content = normalizeForAbuse(message.content || '');
    if (BOT_NAME_PATTERN.test(content))
        return true;
    if (BOT_SUBSTRING_PATTERN.test(content))
        return true;
    // إهانة مباشرة بلا ذكر البوت — "كسمك" وحدها لا تُقرأ كترحيب؛ اللعب = مستهدِف
    for (const phrase of STANDALONE_INSULTS) {
        if (content.includes(phrase))
            return true;
    }
    return false;
}
function buildTokenVariants(token) {
    const out = new Set([token]);
    // إزالة نداء شائع ملتصق: يا/ي (ياغبي، ياحمار)
    for (const prefix of ['يا', 'ي', 'ويا', 'اي', 'ايه']) {
        if (token.startsWith(prefix) && token.length > prefix.length + 1) {
            out.add(token.slice(prefix.length));
        }
    }
    // إزالة "ال" التعريف الشائعة إن بقيت بشكل ملتصق
    for (const t of Array.from(out)) {
        if (t.startsWith('ال') && t.length > 3)
            out.add(t.slice(2));
    }
    // صيغ نهاية شائعة
    for (const t of Array.from(out)) {
        if (t.endsWith('ه') && t.length > 2)
            out.add(t.slice(0, -1) + 'ة');
        if (t.endsWith('ي') && t.length > 2)
            out.add(t.slice(0, -1));
    }
    return Array.from(out);
}
function hasAbuse(text, guildBadWords) {
    const allRaw = Array.isArray(guildBadWords) && guildBadWords.length
        ? INSULT_WORDS.concat(guildBadWords)
        : INSULT_WORDS;
    const normalizedText = normalizeForAbuse(text);
    if (!normalizedText)
        return false;
    const tokens = normalizedText.split(' ').filter(Boolean);
    const tokenSet = new Set(tokens);
    const expandedTokenSet = new Set();
    for (const tok of tokens) {
        for (const v of buildTokenVariants(tok))
            expandedTokenSet.add(v);
    }
    for (const rawWord of allRaw) {
        const word = normalizeForAbuse(rawWord);
        if (!word)
            continue;
        // عبارة متعددة الكلمات: نبحث عنها كعبارة متجاورة داخل النص المطبّع
        if (word.includes(' ')) {
            if (normalizedText.includes(word))
                return true;
            continue;
        }
        // كلمة إنجليزية: تطابق تام + جمع بسيط
        if (/^[a-z0-9]+$/i.test(word)) {
            if (expandedTokenSet.has(word) || expandedTokenSet.has(`${word}s`) || tokenSet.has(word))
                return true;
            continue;
        }
        // كلمة عربية/أخرى: قارن ضد التوكنات وصيغها (يا/ال/نهايات) مع تطبيع موحّد
        for (const tok of tokens) {
            const variants = buildTokenVariants(tok);
            for (const v of variants) {
                if (v === word)
                    return true;
                // دعم صيغ شائعة: ال+كلمة، كلمة+ه/ة
                if (v === `ال${word}`)
                    return true;
                if (word.startsWith('ال') && v === word.slice(2))
                    return true;
                if (v === `${word}ه` || v === `${word}ة`)
                    return true;
                if ((word.endsWith('ه') || word.endsWith('ة')) && v === word.slice(0, -1))
                    return true;
            }
        }
    }
    return false;
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
        if (member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
            logger.debug(`AntiBotAbuse: تجاوز ${member.user.tag} — لديه صلاحية Administrator`);
            return false;
        }
        // 🚦 رتبة العضو يجب أن تكون أقل من رتبة البوت **للتصعيد فقط** (سحب رولات/حظر).
        //    الحذف والتحذير يعملان حتى لو كانت رتبته أعلى — Discord يسمح بحذف الرسائل بصلاحية ManageMessages
        //    بغض النظر عن ترتيب الرولات، فلا نصمت تماماً كما كان يحدث سابقاً.
        const canEscalate = !member.roles.highest || botMember.roles.highest.position > member.roles.highest.position;
        // هل الرسالة تستهدف البوت فعلاً؟
        if (!(await targetsBot(message, client)))
            return false;
        if (!hasAbuse(message.content || '', settings?.automod?.badWords))
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
            const escalationHint = canEscalate
                ? 'إذا كررتها ستُسحب رولاتك. في المرة الثالثة يتم الحظر.'
                : `لا أستطيع سحب رولاتك أو حظرك لأن رولك «${member.roles.highest.name}» أعلى من رول البوت — رتّب رول البوت أعلى لحماية كاملة.`;
            await message.channel.send({
                content: `⚠️ ${member} هذه إساءة للبوت — مرة واحدة فقط مسموحة. ${escalationHint}`,
            }).catch(() => { });
            await sendLog('تحذير لفظي');
            return true;
        }
        // 2️⃣ سحب كل الرولات القابلة للإزالة
        if (count === 2) {
            // ❗ رول العضو أعلى من رول البوت → لا يمكن سحب الرولات أو الحظر
            if (!canEscalate) {
                await message.channel.send({
                    content: `⚠️ ${member} تم تسجيل إساءة جديدة للبوت (${count}). رولك «${member.roles.highest.name}» أعلى من رول البوت، لذلك لا أستطيع سحب الرولات أو الحظر — رتّب رول البوت أعلى لحماية كاملة.`,
                }).catch(() => { });
                await sendLog(`تعذر التصعيد — رول العضو «${member.roles.highest.name}» أعلى من رول البوت`);
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
            await message.channel.send({
                content: `🚫 ${member} سحبت رولاتك بسبب الإساءة المتكررة للبوت. المرة القادمة = حظر.`,
            }).catch(() => { });
            await sendLog(`سحب ${removedNames.length} رول: ${removedNames.join('، ') || 'لا توجد رولات قابلة للإزالة'}`);
            return true;
        }
        // 3️⃣ حظر
        if (count >= 3) {
            if (!canEscalate) {
                await message.channel.send({
                    content: `⚠️ ${member} تم تسجيل إساءة جديدة للبوت (${count}). رولك «${member.roles.highest.name}» أعلى من رول البوت، لذلك لا أستطيع الحظر — رتّب رول البوت أعلى لحماية كاملة.`,
                }).catch(() => { });
                await sendLog(`تعذر الحظر — رول العضو «${member.roles.highest.name}» أعلى من رول البوت`);
                return true;
            }
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