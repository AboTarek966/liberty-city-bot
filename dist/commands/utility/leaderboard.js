"use strict";
// ============================================
// Liberty City Bot - Leaderboard Command
// Interactive beautiful leaderboard (chat + voice)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMinutes = formatMinutes;
exports.periodLabel = periodLabel;
exports.buildLeaderboardEmbed = buildLeaderboardEmbed;
exports.buildLeaderboardButtons = buildLeaderboardButtons;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
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
    return period === 'day' ? '📅 اليوم' :
        period === 'week' ? '📆 هذا الأسبوع' :
            period === 'month' ? '🗓️ هذا الشهر' : '📈 الإجمالي';
}
function limitNumber(limit) {
    return limit === 'all' ? 100 : parseInt(limit, 10);
}
function buildRankingLines(results, type) {
    if (results.length === 0)
        return ['📭 لا توجد بيانات بعد في هذه الفترة'];
    const lines = [];
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const value = type === 'messages'
            ? `**${r.messages}** رسالة`
            : `**${formatMinutes(r.voiceMinutes)}**`;
        const medal = medals[i] || `**${i + 1}.**`;
        lines.push(`${medal} <@${r.userId}> — ${value}`);
    }
    return lines;
}
async function buildLeaderboardEmbed(client, guildId, type, period, limit) {
    const ln = limitNumber(limit);
    const resultsMsg = await client.activityTracker.getLeaderboard(guildId, period, 'messages', type === 'voiceMinutes' ? 1 : ln);
    const resultsVoice = await client.activityTracker.getLeaderboard(guildId, period, 'voiceMinutes', type === 'messages' ? 1 : ln);
    const embed = new discord_js_1.EmbedBuilder().setColor(embeds_1.Colors.warning);
    if (type === 'all') {
        embed.setTitle(`🏆 لوحة المتصدرين — ${periodLabel(period)}`);
        const topMsg = resultsMsg.slice(0, limitNumber(limit));
        const topVoice = resultsVoice.slice(0, limitNumber(limit));
        embed.addFields({
            name: '📝 توب الشات',
            value: topMsg.length
                ? buildRankingLines(topMsg, 'messages').join('\n').substring(0, 1024)
                : '📭 لا توجد بيانات',
            inline: true,
        }, {
            name: '🔊 توب الصوت',
            value: topVoice.length
                ? buildRankingLines(topVoice, 'voiceMinutes').join('\n').substring(0, 1024)
                : '📭 لا توجد بيانات',
            inline: true,
        });
    }
    else if (type === 'messages') {
        embed.setTitle(`📝 توب الرسائل — ${periodLabel(period)}`);
        embed.setDescription(resultsMsg.length
            ? buildRankingLines(resultsMsg, 'messages').join('\n').substring(0, 4000)
            : '📭 لا توجد بيانات رسائل بعد');
    }
    else {
        embed.setTitle(`🔊 توب الوقت الصوتي — ${periodLabel(period)}`);
        embed.setDescription(resultsVoice.length
            ? buildRankingLines(resultsVoice, 'voiceMinutes').join('\n').substring(0, 4000)
            : '📭 لا توجد بيانات صوتية بعد');
    }
    return embed;
}
function buildLeaderboardButtons(type, period, limit) {
    const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|all|${period}|${limit}`)
        .setLabel('الكل')
        .setStyle(type === 'all' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🏆'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|messages|${period}|${limit}`)
        .setLabel('الشات')
        .setStyle(type === 'messages' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📝'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|voiceMinutes|${period}|${limit}`)
        .setLabel('الصوت')
        .setStyle(type === 'voiceMinutes' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🔊'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|${period}|${limit}`)
        .setLabel('تحديث')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🔄'));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|day|${limit}`)
        .setLabel('يومي')
        .setStyle(period === 'day' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📅'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|week|${limit}`)
        .setLabel('أسبوعي')
        .setStyle(period === 'week' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📆'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|month|${limit}`)
        .setLabel('شهري')
        .setStyle(period === 'month' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🗓️'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|total|${limit}`)
        .setLabel('الإجمالي')
        .setStyle(period === 'total' ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📈'));
    const row3 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|${period}|10`)
        .setLabel('توب 10')
        .setStyle(limit === '10' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🔟'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|${period}|25`)
        .setLabel('توب 25')
        .setStyle(limit === '25' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('👥'), new discord_js_1.ButtonBuilder()
        .setCustomId(`lb|${type}|${period}|all`)
        .setLabel('كل الأعضاء')
        .setStyle(limit === 'all' ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📜'));
    return [row1, row2, row3];
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('🏆 لوحة المتصدرين — توب الأعضاء في الشات والصوت')
        .addStringOption(option => option
        .setName('type')
        .setDescription('نوع التصنيف')
        .setRequired(false)
        .addChoices({ name: '🏆 الكل (شات + صوت)', value: 'all' }, { name: '📝 الرسائل', value: 'messages' }, { name: '🔊 الوقت الصوتي', value: 'voiceMinutes' }))
        .addStringOption(option => option
        .setName('period')
        .setDescription('الفترة الزمنية')
        .setRequired(false)
        .addChoices({ name: '📅 يومي', value: 'day' }, { name: '📆 أسبوعي', value: 'week' }, { name: '🗓️ شهري', value: 'month' }, { name: '📈 إجمالي', value: 'total' }))
        .addStringOption(option => option
        .setName('limit')
        .setDescription('عدد الأعضاء المعروضين')
        .setRequired(false)
        .addChoices({ name: '🔟 توب 10', value: '10' }, { name: '👥 توب 25', value: '25' }, { name: '📜 كل الأعضاء', value: 'all' })),
    cooldown: 10,
    async execute(interaction) {
        const client = interaction.client;
        const type = (interaction.options.getString('type') || 'all');
        const period = (interaction.options.getString('period') || 'week');
        const limit = (interaction.options.getString('limit') || '10');
        const embed = await buildLeaderboardEmbed(client, interaction.guildId, type, period, limit);
        const components = buildLeaderboardButtons(type, period, limit);
        await interaction.reply({ embeds: [embed], components });
    },
};
exports.default = command;
//# sourceMappingURL=leaderboard.js.map