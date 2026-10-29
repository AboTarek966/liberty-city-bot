"use strict";
// ============================================
// Liberty City Bot - توب إداريين التذاكر
// قائمة متصدرين لاستلام التذاكر بفترة (يومي/أسبوعي/شهري/إجمالي)
// الشكل: ميداليات + ترتيب نظيف + أزرار فترة وتنقل
// customId: ttop|<period>|<page>
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_TOP_PERIODS = void 0;
exports.sanitizeTicketTopPeriod = sanitizeTicketTopPeriod;
exports.ticketPeriodLabel = ticketPeriodLabel;
exports.buildTicketTopPage = buildTicketTopPage;
exports.buildTicketTopComponents = buildTicketTopComponents;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const embeds_1 = require("./embeds");
exports.TICKET_TOP_PERIODS = ['day', 'week', 'month', 'total'];
function sanitizeTicketTopPeriod(v) {
    return exports.TICKET_TOP_PERIODS.includes(v) ? v : 'total';
}
function ticketPeriodLabel(period) {
    return period === 'day' ? '📅 اليوم'
        : period === 'week' ? '📆 هذا الأسبوع'
            : period === 'month' ? '🗓️ هذا الشهر'
                : '📈 الإجمالي';
}
const PAGE_SIZE = 5;
const MEDALS = ['🥇', '🥈', '🥉'];
function periodStart(period) {
    const now = new Date();
    if (period === 'day') {
        now.setHours(0, 0, 0, 0);
        return now;
    }
    if (period === 'week') {
        // بداية الأسبوع = الأحد
        const day = now.getDay();
        now.setDate(now.getDate() - day);
        now.setHours(0, 0, 0, 0);
        return now;
    }
    if (period === 'month') {
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        return now;
    }
    return null; // الإجمالي
}
async function buildTicketTopPage(guild, period, page) {
    const settings = await (0, models_1.getGuildSettings)(guild.id);
    const start = periodStart(period);
    // عدّ التذاكر المستلمة لكل إداري حسب الفترة
    const counts = new Map();
    const log = settings.tickets.claimLog || [];
    if (start) {
        for (const entry of log) {
            const at = new Date(entry.at);
            if (at >= start)
                counts.set(entry.userId, (counts.get(entry.userId) || 0) + 1);
        }
    }
    else {
        // الإجمالي من العدّاد الكلي المحفوظ
        const stats = settings.tickets.claimStats;
        if (stats)
            for (const [uid, c] of stats.entries())
                if (c > 0)
                    counts.set(uid, c);
    }
    const sorted = [...counts.entries()]
        .filter(([, c]) => c > 0)
        .sort((a, b) => b[1] - a[1]);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const lines = slice.map(([userId, count], i) => {
        const rank = (safePage - 1) * PAGE_SIZE + i + 1;
        const badge = MEDALS[rank - 1] || `**#${rank}**`;
        return `${badge} <@${userId}> — **${count}** تذكرة`;
    });
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embeds_1.Colors.primary)
        .setTitle(`🎫 توب إداريين التذاكر — ${ticketPeriodLabel(period)}`)
        .setDescription([
        `🏆 **${guild.name}**`,
        '',
        lines.length ? lines.join('\n') : '📭 لا توجد تذاكر مستلمة في هذه الفترة بعد',
    ].join('\n'))
        .setFooter({ text: `الصفحة ${safePage}/${totalPages} • ${sorted.length} إداري` })
        .setTimestamp();
    const icon = guild.iconURL({ size: 128 });
    if (icon)
        embed.setThumbnail(icon);
    return {
        embed,
        components: buildTicketTopComponents(period, safePage, totalPages),
        page: safePage,
        totalPages,
        totalAdmins: sorted.length,
    };
}
function buildTicketTopComponents(period, page, totalPages) {
    const at = (p, mark) => `ttop|${period}|${p}${mark ? `|${mark}` : ''}`;
    const nav = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(at(page, 'prev')).setEmoji('⬅️').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page <= 1), new discord_js_1.ButtonBuilder().setCustomId(`ttopg|${page}`).setLabel(`${page}`).setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(true), new discord_js_1.ButtonBuilder().setCustomId(at(page, 'next')).setEmoji('➡️').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(page >= totalPages), new discord_js_1.ButtonBuilder().setCustomId(at(page, 'r')).setEmoji('🔄').setLabel('تحديث').setStyle(discord_js_1.ButtonStyle.Primary));
    const periods = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`ttop|day|1|p`).setLabel('يومي').setEmoji('📅').setStyle(period === 'day' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(`ttop|week|1|p`).setLabel('أسبوعي').setEmoji('📆').setStyle(period === 'week' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(`ttop|month|1|p`).setLabel('شهري').setEmoji('🗓️').setStyle(period === 'month' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(`ttop|total|1|p`).setLabel('الإجمالي').setEmoji('📈').setStyle(period === 'total' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary));
    return [nav, periods];
}
//# sourceMappingURL=ticketTop.js.map