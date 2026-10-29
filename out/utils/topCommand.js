"use strict";
// ============================================
// Liberty City Bot - أمر النصي `top`
//   top            → الأسبوعي (الافتراضي)
//   top يومي       → يومي
//   top اسبوعي     → أسبوعي
//   top شهري       → شهري
//   top اجمالي     → إجمالي
// يعمل بدون بادئة وبدون منشن — مثل الصورة المرجعية
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTopCommand = handleTopCommand;
const helpers_1 = require("./helpers");
const leaderboard_1 = require("../commands/utility/leaderboard");
const logger = (0, helpers_1.createLogger)('TopCommand');
// --------------------------------------------
// تطبيع النص العربي/الإنجليزي للمقارنة
// --------------------------------------------
function norm(s) {
    return s
        .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // تشكيل + تطويل
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .toLowerCase()
        .trim();
}
const RAW_TRIGGERS = [
    'top', 'tob', 'top10', 'tob10', 'توب', 'توب10',
    'ليدر', 'ليدربورد', 'leaderboard', 'toboard',
    'rank', 'ranks', 'ranking',
];
const TRIGGERS = new Set(RAW_TRIGGERS.map(norm));
const RAW_PERIODS = {
    day: 'day', daily: 'day', يومي: 'day', يوم: 'day', اليوم: 'day', يوميا: 'day',
    week: 'week', weekly: 'week', اسبوعي: 'week', اسبوع: 'week', الاسبوع: 'week',
    اسبوعيا: 'week', ويكلي: 'week',
    month: 'month', monthly: 'month', شهري: 'month', شهر: 'month', الشهر: 'month',
    شهريا: 'month',
    total: 'total', all: 'total', اجمالي: 'total', الاجمالي: 'total', اجمالى: 'total',
    كلي: 'total', عام: 'total', الافضل: 'total', الاعلى: 'total',
};
const PERIODS = {};
for (const [k, v] of Object.entries(RAW_PERIODS))
    PERIODS[norm(k)] = v;
const RAW_TYPES = {
    all: 'all', الكل: 'all', شامل: 'all',
    messages: 'messages', message: 'messages', شات: 'messages', دردشة: 'messages',
    دردشه: 'messages', رسائل: 'messages', رسالة: 'messages', كلام: 'messages',
    chat: 'messages', text: 'messages', نص: 'messages',
    voice: 'voiceMinutes', voiceMinutes: 'voiceMinutes', صوت: 'voiceMinutes',
    الصوت: 'voiceMinutes', صوتي: 'voiceMinutes', صوتيه: 'voiceMinutes', voiceTime: 'voiceMinutes',
    vocal: 'voiceMinutes', micro: 'voiceMinutes', مايك: 'voiceMinutes',
};
const TYPES = {};
for (const [k, v] of Object.entries(RAW_TYPES))
    TYPES[norm(k)] = v;
// --------------------------------------------
// كولداون بسيط (يمنع إغراق القناة بالتوب)
// --------------------------------------------
const cooldowns = new Map();
const COOLDOWN_MS = 4000;
function onCooldown(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const until = cooldowns.get(key) || 0;
    if (now < until)
        return true;
    cooldowns.set(key, now + COOLDOWN_MS);
    // تنظيف دوري
    if (cooldowns.size > 500) {
        for (const [k, v] of cooldowns)
            if (v < now)
                cooldowns.delete(k);
    }
    return false;
}
// --------------------------------------------
// المعالج
// --------------------------------------------
async function handleTopCommand(message, client) {
    try {
        if (!message.guild || message.author.bot)
            return false;
        const content = message.content || '';
        if (content.length > 80)
            return false; // جملة طويلة = ليست أمراً
        const parts = content.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0 || parts.length > 5)
            return false;
        // الكلمة الأولى يجب أن تكون محفّزاً معروفاً
        if (!TRIGGERS.has(norm(parts[0])))
            return false;
        let period = 'week';
        let type = 'all';
        let limit = 'all';
        // بقية الكلمات: فترة / نوع — كلمة غريبة = ليست أمراً (لا نخطف جملة عادية)
        for (const raw of parts.slice(1)) {
            const w = norm(raw);
            if (PERIODS[w])
                period = PERIODS[w];
            else if (TYPES[w])
                type = TYPES[w];
            else if (w === '10')
                limit = '10';
            else if (w === '25')
                limit = '25';
            else
                return false;
        }
        if (onCooldown(message.guild.id, message.author.id))
            return false;
        const page = await (0, leaderboard_1.buildLeaderboardPage)(client, message.guild, type, period, limit, 1);
        await message.reply({ embeds: [page.embed], components: page.components });
        return true;
    }
    catch (error) {
        logger.error('Error in top command:', error);
        return false;
    }
}
exports.default = handleTopCommand;
//# sourceMappingURL=topCommand.js.map