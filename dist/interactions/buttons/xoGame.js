"use strict";
// ============================================
// Liberty City Bot - XO Button (حركات اللاعبين)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const xoGame_1 = require("../../utils/xoGame");
const handler = {
    id: 'xo',
    async execute(interaction) {
        await interaction.deferUpdate(); // ✅ فوراً
        const [, gameId, idxStr] = interaction.customId.split(':');
        const idx = Number.parseInt(idxStr, 10);
        const game = (0, xoGame_1.getXoGame)(gameId);
        if (!game) {
            await interaction.editReply({
                content: '⌛ انتهت هذه اللعبة — ابدأ لعبة جديدة بـ `/xo`',
                embeds: [],
                components: [],
            });
            return;
        }
        const playerIdx = game.players.indexOf(interaction.user.id);
        if (playerIdx === -1) {
            await interaction.followUp({ content: '❌ هذه اللعبة بين لاعبين فقط', ephemeral: true });
            return;
        }
        if (playerIdx !== game.turn) {
            await interaction.followUp({ content: '⏳ ليس دورك الآن', ephemeral: true });
            return;
        }
        if (!Number.isInteger(idx) || idx < 0 || idx > 8 || game.board[idx]) {
            return; // خانة ممتلئة أو حركة غير صالحة — تجاهل بصمت
        }
        const mark = playerIdx === 0 ? 'X' : 'O';
        game.board[idx] = mark;
        game.turn = playerIdx === 0 ? 1 : 0;
        const result = (0, xoGame_1.checkWinner)(game.board);
        if (result === 'تعادل') {
            (0, xoGame_1.endXoGame)(game.id);
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(embeds_1.Colors.warning)
                        .setTitle('🤝 تعادل!')
                        .setDescription(`${game.players.map(p => `<@${p}>`).join(' و')} تعادلا!`),
                ],
                components: (0, xoGame_1.renderXoBoard)(game, true),
            });
            return;
        }
        if (result) {
            (0, xoGame_1.endXoGame)(game.id);
            const winner = result === 'X' ? game.players[0] : game.players[1];
            const loser = result === 'X' ? game.players[1] : game.players[0];
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(embeds_1.Colors.success)
                        .setTitle('🏆 فائز!')
                        .setDescription(`🎉 <@${winner}> (${result}) هزم <@${loser}> — لعبة رائعة!`),
                ],
                components: (0, xoGame_1.renderXoBoard)(game, true),
            });
            return;
        }
        const nextMention = `<@${game.players[game.turn]}>`;
        await interaction.editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.primary)
                    .setTitle('❌⭕ دورك الآن')
                    .setDescription(`${nextMention} عليك اللعب — الحين دور **${game.turn === 0 ? 'X' : 'O'}**`),
            ],
            components: (0, xoGame_1.renderXoBoard)(game),
        });
    },
};
exports.default = handler;
//# sourceMappingURL=xoGame.js.map