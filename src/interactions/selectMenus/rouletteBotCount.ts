// ============================================
// Omni Bot - 🤖 اختيار عدد البوتات في الروليت
// roulette_bot_count:<gameId> — اللعبة تنشئ N بوت بأسماء يخترعها البوت
// ============================================

import { StringSelectMenuInteraction } from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import {
  rouletteGames,
  lobbyEmbed,
  lobbyRow,
  inventPlayersForGame,
} from '../../utils/rouletteGame';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('RouletteBots');

const handler: SelectMenuHandler = {
  id: 'roulette_bot_count',
  async execute(interactionRaw) {
    const interaction = interactionRaw as StringSelectMenuInteraction;
    const gameId = interaction.customId.slice('roulette_bot_count:'.length);

    const game = rouletteGames.get(gameId);
    if (!game) {
      await interaction.update({
        content: '❌ اللعبة انتهت أو غير متاحة — ابدأ واحدة تانية.',
        components: [],
      });
      return;
    }
    if (game.phase !== 'lobby') {
      await interaction.update({
        content: '❌ بدأت اللعبة بالفعل — ممنوع الإضافة الآن.',
        components: [],
      });
      return;
    }

    const count = parseInt(interaction.values[0] || '0', 10);
    const added = inventPlayersForGame(count, game.players);
    if (added.length === 0) {
      await interaction.update({
        content: '❌ اللعبة ممتلئة (25 لاعب) — ما أقدر أضيف أكتر من كده.',
        components: [],
      });
      return;
    }

    game.players.push(...added);

    // حدّث رسالة اللوبي العامة بكل اللاعبين الجدد
    try {
      const ch: any = interaction.channel;
      if (game.messageId && ch?.messages?.fetch) {
        const msg = await ch.messages.fetch(game.messageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [lobbyEmbed(game)], components: lobbyRow(game) });
      }
    } catch (err: any) {
      logger.warn(`lobby update failed: ${err?.message || err}`);
    }

    const names = added.map((p) => p.username).join('، ');
    await interaction.update({
      content: `🤖 أضفت **${added.length}** لاعب وهمي للعجلة:\n${names}`,
      components: [],
    });
  },
};

export default handler;
