// ============================================
// Omni Bot - Roulette (روليت) — لعبة جماعية تفاعلية
// /roulette → زر دخول + زر خروج، بعد 60 ثانية تبدأ، والعجلة تدور كل جولة
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import {
  rouletteGames,
  lobbyEmbed,
  lobbyRow,
  startRouletteGame,
} from '../../utils/rouletteGame';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('Roulette');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🔫 لعبة روليت جماعية — انضم للعبة، العجلة بتلف، واللي تقف عليه يطرد!')
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    // منع تكرار لوبي نشط في نفس القناة
    for (const g of rouletteGames.values()) {
      if (g.channelId === interaction.channelId && g.phase !== 'done') {
        await interaction.editReply({ content: '⚠️ في لعبة روليت شغالة بالفعل في هذه القناة — انتظر حتى تنتهي.' });
        return;
      }
    }

    const gameId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
      .toString(36)
      .padStart(2, '0')}`;

    const game = {
      id: gameId,
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      phase: 'lobby' as const,
      players: [] as Array<{ id: string; username: string; avatarUrl?: string }>,
      avatarBuffers: [] as Array<Buffer | null>,
      chooserId: undefined as string | undefined,
      choiceMessageId: undefined as string | undefined,
      choiceTimer: undefined as NodeJS.Timeout | undefined,
      startTimer: undefined as NodeJS.Timeout | undefined,
      messageId: undefined as string | undefined,
    };

    rouletteGames.set(gameId, game);

    // عد تنازلي — 60 ثانية ثم تُبنى اللعبة
    const timer = setTimeout(() => {
      void startRouletteGame(interaction.client as any, gameId);
    }, 60_000);
    game.startTimer = timer;

    const player0 = {
      id: interaction.user.id,
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 64 }),
    };
    game.players.push(player0);

    const message = await interaction.editReply({
      embeds: [lobbyEmbed(game)],
      components: lobbyRow(game),
    });
    game.messageId = (message as any)?.id;

    logger.info(`Roulette lobby created ${gameId} by ${interaction.user.tag} (${game.players.length} players)`);
  },
};

export default command;
