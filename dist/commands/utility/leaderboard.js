"use strict";
// ============================================
// Liberty City Bot - Leaderboard Command
// قائمة متصدرين بتبويب (يومي/أسبوعي/شهري/إجمالي) + ترقيم صفحات
// الشكل:  #1 @user — 📝 رسائل • 🔊 صوت
// الأزرار: ⬅️ | رقم الصفحة | ➡️ | 🔄 تحديث
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.LB_PAGE_SIZE = void 0;
exports.formatMinutes = formatMinutes;
exports.periodLabel = periodLabel;
exports.limitNumber = limitNumber;
exports.fetchLeaderboardRows = fetchLeaderboardRows;
exports.clampPage = clampPage;
exports.buildLeaderboardPage = buildLeaderboardPage;
exports.buildLeaderboardComponents = buildLeaderboardComponents;
exports.sanitizeType = sanitizeType;
exports.sanitizePeriod = sanitizePeriod;
exports.sanitizeLimit = sanitizeLimit;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
/** عدد الأعضاء في كل صفحة — مطابق للشكل المطلوب (5 صفوف) */
exports.LB_PAGE_SIZE = 5;
/** أقصى عدد صفوف نجلبه من قاعدة البيانات (حد أقصى للتصفح) */
const MAX_ROWS = 100;
// --------------------------------------------
// Helpers
// --------------------------------------------
function formatMinutes(total) {
    if (total < 60)
        return `${total} دقيقة`;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours < 24)
        return `${hours} ساعة${mins ? ` ${mins} دقيقة` : ''}`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} يوم${remHours ? ` ${remHours} ساعة` : ''}`;
}
function periodLabel(period) {
    return period === 'day' ? '📅 اليوم'
        : period === 'week' ? '📆 هذا الأسبوع'
            : period === 'month' ? '🗓️ هذا الشهر' : '📈 الإجمالي';
}
function limitNumber(limit) {
    return limit === 'all' ? MAX_ROWS : parseInt(limit, 10);
}
/** ترقيم الصفحة بالعربية: الأولى، الثانية… ثم رقم عادي بعد العاشرة */
const AR_PAGES = [
    'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة',
    'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة',
];
function pageWord(page) {
    return AR_PAGES[page - 1] || `${page}`;
}
async function fetchLeaderboardRows(client, guildId, period, type, limit) {
    const ln = limitNumber(limit);
    const [msgRows, voiceRows] = await Promise.all([
        client.activityTracker.getLeaderboard(guildId, period, 'messages', ln),
        client.activityTracker.getLeaderboard(guildId, period, 'voiceMinutes', ln),
    ]);
    // دمج القائمتين: نفس العضو قد يظهر فيهما معاً
    const map = new Map();
    const put = (r) => {
        const id = r?.userId;
        if (!id)
            return;
        const m = r.messages || 0;
        const v = r.voiceMinutes || 0;
        const cur = map.get(id);
        if (!cur)
            map.set(id, { messages: m, voiceMinutes: v });
        else {
            cur.messages = Math.max(cur.messages, m);
            cur.voiceMinutes = Math.max(cur.voiceMinutes, v);
        }
    };
    msgRows.forEach(put);
    voiceRows.forEach(put);
    const rows = [];
    for (const [userId, s] of map) {
        // معيار الترتيب: حسب النوع المختار (الكل = مجموع النشاط)
        const score = type === 'voiceMinutes' ? s.voiceMinutes
            : type === 'messages' ? s.messages
                : s.messages + s.voiceMinutes;
        if (score <= 0)
            continue; // لا نعرض من لا نشاط له
        rows.push({ userId, messages: s.messages, voiceMinutes: s.voiceMinutes, score });
    }
    rows.sort((a, b) => b.score - a.score ||
        b.messages - a.messages ||
        b.voiceMinutes - a.voiceMinutes ||
        a.userId.localeCompare(b.userId));
    return rows;
}
function clampPage(page, totalPages) {
    if (!Number.isFinite(page) || page < 1)
        return 1;
    if (totalPages < 1)
        return 1;
    return Math.min(Math.floor(page), totalPages);
}
async function buildLeaderboardPage(client, guild, type, period, limit, page) {
    const rows = await fetchLeaderboardRows(client, guild.id, period, type, limit);
    const totalPages = Math.max(1, Math.ceil(rows.length / exports.LB_PAGE_SIZE));
    const safePage = clampPage(page, totalPages);
    const start = (safePage - 1) * exports.LB_PAGE_SIZE;
    const slice = rows.slice(start, start + exports.LB_PAGE_SIZE);
    const lines = slice.map((r, i) => {
        const rank = start + i + 1;
        return (`**#${rank}** <@${r.userId}> — ` +
            `📝 **${r.messages.toLocaleString('en-US')}** رسالة • ` +
            `🔊 **${formatMinutes(r.voiceMinutes)}**`);
    });
    const description = [
        `🏆 **${guild.name}**`,
        '',
        lines.length
            ? lines.join('\n')
            : '📭 لا توجد بيانات نشاط في هذه الفترة بعد',
    ].join('\n');
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embeds_1.Colors.warning)
        .setTitle(`قائمة المتصدرين — ${periodLabel(period)}`)
        .setDescription(description.substring(0, 4000))
        .setFooter({
        text: `الصفحة: ${pageWord(safePage)} • ${safePage}/${totalPages} صفحة • ${rows.length} عضو`,
    })
        .setTimestamp();
    const icon = guild.iconURL({ size: 128 });
    if (icon)
        embed.setThumbnail(icon);
    return {
        embed,
        components: buildLeaderboardComponents(type, period, limit, safePage, totalPages),
        page: safePage,
        totalPages,
        totalRows: rows.length,
    };
}
// --------------------------------------------
// الأزرار
// customId: lb|<type>|<period>|<limit>|<page>[|<mark>]
//   mark: prev / next / r (تحديث) / p (فترة) / t (نوع)
// البادئة المختلفة تضمن عدم تكرار custom_id داخل الرسالة الواحدة
// --------------------------------------------
function buildLeaderboardComponents(type, period, limit, page, totalPages) {
    const at = (p, mark) => `lb|${type}|${period}|${limit}|${p}${mark ? `|${mark}` : ''}`;
    // الصف الأول — التنقل (مطابق للشكل: ⬅️ | رقم | ➡️ | 🔄)
    const nav = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(at(page, 'prev'))
        .setEmoji('⬅️')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(page <= 1), new discord_js_1.ButtonBuilder()
        .setCustomId(`pg|${page}`)
        .setLabel(`${page}`)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(true), new discord_js_1.ButtonBuilder()
        .setCustomId(at(page, 'next'))
        .setEmoji('➡️')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(page >= totalPages), new discord_js_1.ButtonBuilder()
        .setCustomId(at(page, 'r'))
        .setEmoji('🔄')
        .setLabel('تحديث')
        .setStyle(discord_js_1.ButtonStyle.Primary));
    // الصف الثاني — الفترة (تختلف النتائج معها)
    const periods = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|day|${limit}|1|p`)
        .setLabel('يومي')
        .setEmoji('📅')
        .setStyle(period === 'day' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|week|${limit}|1|p`)
        .setLabel('أسبوعي')
        .setEmoji('📆')
        .setStyle(period === 'week' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|month|${limit}|1|p`)
        .setLabel('شهري')
        .setEmoji('🗓️')
        .setStyle(period === 'month' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|total|${limit}|1|p`)
        .setLabel('الإجمالي')
        .setEmoji('📈')
        .setStyle(period === 'total' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary));
    // الصف الثالث — نوع الترتيب
    const types = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|all|${period}|${limit}|1|t`)
        .setLabel('الكل')
        .setEmoji('🏆')
        .setStyle(type === 'all' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|messages|${period}|${limit}|1|t`)
        .setLabel('الشات')
        .setEmoji('📝')
        .setStyle(type === 'messages' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|voiceMinutes|${period}|${limit}|1|t`)
        .setLabel('الصوت')
        .setEmoji('🔊')
        .setStyle(type === 'voiceMinutes' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary));
    return [nav, periods, types];
}
// --------------------------------------------
// Slash Command
// --------------------------------------------
const VALID_TYPES = ['all', 'messages', 'voiceMinutes'];
const VALID_PERIODS = ['day', 'week', 'month', 'total'];
const VALID_LIMITS = ['10', '25', 'all'];
function sanitizeType(v) {
    return VALID_TYPES.includes(v) ? v : 'all';
}
function sanitizePeriod(v) {
    return VALID_PERIODS.includes(v) ? v : 'week';
}
function sanitizeLimit(v) {
    return VALID_LIMITS.includes(v) ? v : 'all';
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('🏆 قائمة المتصدرين — توب الأعضاء يومياً وأسبوعياً وشهرياً')
        .addStringOption(option => option
        .setName('type')
        .setDescription('نوع الترتيب')
        .setRequired(false)
        .addChoices({ name: '🏆 الكل (شات + صوت)', value: 'all' }, { name: '📝 الرسائل', value: 'messages' }, { name: '🔊 الوقت الصوتي', value: 'voiceMinutes' }))
        .addStringOption(option => option
        .setName('period')
        .setDescription('الفترة الزمنية')
        .setRequired(false)
        .addChoices({ name: '📅 يومي', value: 'day' }, { name: '📆 أسبوعي', value: 'week' }, { name: '🗓️ شهري', value: 'month' }, { name: '📈 إجمالي', value: 'total' }))
        .addStringOption(option => option
        .setName('limit')
        .setDescription('عدد الأعضاء في القائمة')
        .setRequired(false)
        .addChoices({ name: '🔟 توب 10', value: '10' }, { name: '👥 توب 25', value: '25' }, { name: '📜 كل الأعضاء', value: 'all' })),
    cooldown: 5,
    async execute(interaction) {
        const client = interaction.client;
        const type = sanitizeType(interaction.options.getString('type'));
        const period = sanitizePeriod(interaction.options.getString('period'));
        const limit = sanitizeLimit(interaction.options.getString('limit'));
        const page = await buildLeaderboardPage(client, interaction.guild, type, period, limit, 1);
        await interaction.reply({ embeds: [page.embed], components: page.components });
    },
};
exports.default = command;
//# sourceMappingURL=leaderboard.js.map