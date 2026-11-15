// ============================================
// Omni Bot - ⏹️ إيقاف لعبة الروليت الحالية
// ============================================
// /roulette_stop — يوقف اللعبة الحالية في القناة فوراً ويُعلن نهاية اللعب.
// الصلاحية: ManageGuild (مفيد للقادة) أو مالك السيرفر.
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { rouletteGames, cleanupStoppedGame } from '../../utils/rouletteGame';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('RouletteStop');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roulette_stop')
    .setDescription('⏹️ إيقاف لعبة الروليت الحالية في هذه القناة فوراً')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      await interaction.editReply({ content: '❌ يعمل في السيرفر فقط.' });
      return;
    }

    const guild = interaction.guild;
    const member = guild.members.cache.get(interaction.user.id);
    const isOwner = guild.ownerId === interaction.user.id;
    const hasManage = member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
    if (!isOwner && !hasManage) {
      await interaction.editReply({ content: '⛔ هذا الأمر لمالك السيرفر أو من يملك ManageGuild فقط.' });
      return;
    }

    // أبحث عن أي لعبة جارية في هذه القناة
    const targetChannelId = interaction.channelId;
    const game = [...rouletteGames.values()].find(
      (g) => g.channelId === targetChannelId && g.phase !== 'done'
    );

    if (!game) {
      await interaction.editReply({ content: '🫙 لا توجد لعبة روليت جارية في هذه القناة.' });
      return;
    }

    const playersNow = game.players.length;
    try {
      await cleanupStoppedGame(interaction.client as any, game);
    } catch (err: any) {
      logger.warn(`cleanupStoppedGame error: ${err?.message || err}`);
      rouletteGames.delete(game.id);
    }

    await interaction.editReply({
      content: `🛑 تم إيقاف لعبة الروليت في هذه القناة — كان متبقاً **${playersNow}** مشارك.`,
    });
  },
};

export default command;
