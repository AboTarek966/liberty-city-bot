// ============================================
// Liberty City Bot - XO Button (حركات اللاعبين)
// ============================================

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { Colors } from '../../utils/embeds';
import { getXoGame, endXoGame, checkWinner, renderXoBoard } from '../../utils/xoGame';

const handler: ButtonHandler = {
  id: 'xo',
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate(); // ✅ فوراً

    const [, gameId, idxStr] = interaction.customId.split(':');
    const idx = Number.parseInt(idxStr, 10);
    const game = getXoGame(gameId);

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

    const result = checkWinner(game.board);

    if (result === 'تعادل') {
      endXoGame(game.id);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.warning)
            .setTitle('🤝 تعادل!')
            .setDescription(`${game.players.map(p => `<@${p}>`).join(' و')} تعادلا!`),
        ],
        components: renderXoBoard(game, true),
      });
      return;
    }

    if (result) {
      endXoGame(game.id);
      const winner = result === 'X' ? game.players[0] : game.players[1];
      const loser = result === 'X' ? game.players[1] : game.players[0];
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.success)
            .setTitle('🏆 فائز!')
            .setDescription(`🎉 <@${winner}> (${result}) هزم <@${loser}> — لعبة رائعة!`),
        ],
        components: renderXoBoard(game, true),
      });
      return;
    }

    const nextMention = `<@${game.players[game.turn]}>`;
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.primary)
          .setTitle('❌⭕ دورك الآن')
          .setDescription(`${nextMention} عليك اللعب — الحين دور **${game.turn === 0 ? 'X' : 'O'}**`),
      ],
      components: renderXoBoard(game),
    });
  },
};

export default handler;
