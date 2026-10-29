"use strict";
// ============================================
// Liberty City Bot - Ping Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ping')
        .setDescription('عرض سرعة استجابة البوت'),
    cooldown: 5,
    async execute(interaction) {
        const sent = await interaction.deferReply({ fetchReply: true });
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const websocket = interaction.client.ws.ping;
        await interaction.editReply({
            content: `🏓 Pong! — الاستجابة \`${roundtrip}ms\` • الـ WebSocket \`${websocket}ms\` • ${getRating(roundtrip)}`,
        });
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