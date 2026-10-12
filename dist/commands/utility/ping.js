"use strict";
// ============================================
// Liberty City Bot - Ping Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ping')
        .setDescription('عرض سرعة استجابة البوت'),
    cooldown: 5,
    async execute(interaction) {
        const sent = await interaction.deferReply({ fetchReply: true });
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const websocket = interaction.client.ws.ping;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setColor(roundtrip < 200 ? embeds_1.Colors.success : roundtrip < 500 ? embeds_1.Colors.warning : embeds_1.Colors.error)
            .addFields({
            name: '📡 زمن الاستجابة',
            value: `\`${roundtrip}ms\``,
            inline: true,
        }, {
            name: '💓 قلب البوت (WebSocket)',
            value: `\`${websocket}ms\``,
            inline: true,
        }, {
            name: '📊 التقييم',
            value: getRating(roundtrip),
            inline: true,
        })
            .setFooter({ text: 'Liberty City Bot' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
function getRating(ms) {
    if (ms < 100)
        return '⚡ ممتاز جداً';
    if (ms < 200)
        return '✅ ممتاز';
    if (ms < 300)
        return '👍 جيد جداً';
    if (ms < 500)
        return '👌 جيد';
    if (ms < 1000)
        return '⚠️ متوسط';
    return '❌ بطيء';
}
exports.default = command;
//# sourceMappingURL=ping.js.map