"use strict";
// ============================================
// Liberty City Bot - Scam Link Filter (فلتر الروابط الاحتيالية)
// حماية من روابط صيد النيترو والمشاريع المزيفة (ديسكورد/ستيم/إيлон ماسك...)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkScamContent = checkScamContent;
exports.handleScamFilter = handleScamFilter;
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('ScamFilter');
// نطاقات احتيالية شائعة (تُطابَق بنهاية النطاق)
const SCAM_DOMAINS = [
    // مصائد ديسكورد مزيفة
    'dlscord', 'dlscorcl', 'discorcl', 'dlscord gift', 'discord-activity.site',
    'discorcl-nitro', 'discord-gift.site', 'discorclgift', 'discord-giveaway',
    'discocd', 'dlscord.com', 'discordc', 'discordgift.shop', 'discord-nitro.site',
    'free-nitro.club', 'nitro-promo', 'nitro.gift', 'discrod', 'dlscrod',
    // مصائد ستيم مزيفة
    'steamcormmunity', 'steamcommunlty', 'steamcommunitty', 'steamcommunltty',
    'stearncommunlty', 'steamcommunity.ru', 'steam-gift', 'steancommunity',
    'steamcommunily', 'steambcommunity', 'steamcomrnunity', 'steamcomunity',
    // مصائد أخرى
    'binance-gift', 'elon-giveaway', 'tesla-gift', 'coinbase-gift',
    'metamask-gift', 'airdrop-token', 'claim-airdrop', 'wallet-drainer',
    'grabify', 'iplogger',
];
// كلمات مفتاحية احتيالية (مع تجاهل علامات الترقيم داخلها)
const SCAM_KEYWORDS = [
    'freenitro', 'fre nitro', 'giftnitro', 'claimnitro', 'nitroforfree',
    'discord nitro free', 'steam gift', 'free steam', 'elon musk giveaway',
    'btc giveaway', 'crypto airdrop',
];
// يلتقط روابط http(s) والنطاقات المشبوهة بدون بروتوكول (dlscord.xyz)
const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#][^\s]*)?/gi;
const INVITE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/gi;
/** فحص نص الرسالة بحثاً عن روابط احتيالية */
function checkScamContent(content) {
    const lower = content.toLowerCase();
    // 1) فحص النطاقات في الروابط
    const urlMatches = [...content.matchAll(URL_REGEX)];
    for (const match of urlMatches) {
        const host = (match[1] || '').toLowerCase();
        for (const domain of SCAM_DOMAINS) {
            if (host.includes(domain)) {
                return { isScam: true, reason: 'رابط احتيالي (مشاريع مزيفة)', matched: host };
            }
        }
        // نطاقات مزيفة تنتهي بـ .xyz/.tk/.ml الشائعة في صيد النيترو
        if (/nitro|steam|gift|airdrop|wallet/i.test(host) && /\.(xyz|tk|ml|ga|cf|gq)(\/|$)/.test(host)) {
            return { isScam: true, reason: 'رابط احتيالي مشبوه (نطاق مزيف)', matched: host };
        }
    }
    // 2) فحص الكلمات المفتاحية (بمسافات مرنة)
    const compact = lower.replace(/[\s._-]+/g, '');
    for (const keyword of SCAM_KEYWORDS) {
        const compactKey = keyword.replace(/[\s._-]+/g, '');
        if (compact.includes(compactKey)) {
            return { isScam: true, reason: 'نص احتيالي (كلمات صيد مشبوهة)', matched: keyword };
        }
    }
    return { isScam: false };
}
/** معالجة رسالة واحذفها إن كانت احتيالية (يستدعيها messageCreate) */
async function handleScamFilter(message, client) {
    if (!message.guild || !message.content)
        return false;
    const settings = await (0, models_1.getGuildSettings)(message.guild.id);
    if (!settings.protection?.scamFilter?.enabled)
        return false;
    // ⚠️ لا يوجد أي تجاوز: الروابط الاحتيالية تُحذف للجميع
    // (حتى الإدارة وأصحاب الرتب الخاصة — الاحتيال يهدد الجميع)
    const result = checkScamContent(message.content);
    if (!result.isScam)
        return false;
    // حذف الرسالة
    await message.delete().catch(() => { });
    // إنذار العضو (يختفي بعد 8 ثوانٍ)
    let warning = null;
    if ('send' in message.channel) {
        warning = await message.channel
            .send({
            content: `🚨 <@${message.author.id}> **تم حذف رسالتك — ${result.reason}**\n⚠️ روابط الاحتيال ممنوعة، تكرارها يؤدي لعقوبة.`,
        })
            .catch(() => null);
    }
    if (warning)
        setTimeout(() => warning.delete().catch(() => { }), 8000);
    // تسجيل في قناة السجلات إن وُجدت
    const logChannelId = settings.logging?.channelId;
    if (logChannelId) {
        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (logChannel && 'send' in logChannel) {
            await logChannel
                .send({
                embeds: [
                    {
                        color: 0xe74c3c,
                        title: '🚨 فلتر الاحتيال — رابط محذوف',
                        fields: [
                            { name: '👤 العضو', value: `<@${message.author.id}> (${message.author.tag})`, inline: true },
                            { name: '📍 القناة', value: `<#${message.channel.id}>`, inline: true },
                            { name: '🔗 المطابقة', value: `\`${result.matched || '—'}\` — ${result.reason}`, inline: false },
                            { name: '📄 النص', value: message.content.substring(0, 500) || '—', inline: false },
                        ],
                        footer: { text: 'Liberty City Security' },
                        timestamp: new Date().toISOString(),
                    },
                ],
            })
                .catch(() => { });
        }
    }
    logger.warn(`Scam blocked: ${message.author.tag} in ${message.guild.name} — ${result.matched}`);
    return true;
}
//# sourceMappingURL=scamFilter.js.map