// ============================================
// Liberty City Bot - XO Command (إكس أو — ضد لاعب)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';
import { createXoGame, renderXoBoard } from '../../utils/xoGame';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('xo')
    .setDescription('❌⭕ لعبة XO — تحدَّ عضواً في لعبة إكس أو!')
    .addUserOption(opt =>
      opt.setName('user').setDescription('الخصم').setRequired(true)
    )
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const opponent = interaction.options.getUser('user', true);

    if (opponent.bot) {
      await interaction.reply({ content: '❌ لا يمكنك اللعب ضد بوت', ephemeral: true });
      return;
    }
    if (opponent.id === interaction.user.id) {
      await interaction.reply({ content: '❌ لا يمكنك تحدي نفسك', ephemeral: true });
      return;
    }

    const game = createXoGame(interaction.user.id, opponent.id);

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle('❌⭕ تحدي XO!')
      .setDescription(
        `${interaction.user} يتحدى ${opponent}! • ` +
        `${interaction.user} = **X** (يبدأ أولاً) | ${opponent} = **O**\n` +
        `الأزرار الفارغة قابلة للضغط — اللعبة تنتهي خلال 3 دقائق`
      );

    await interaction.reply({
      embeds: [embed],
      components: renderXoBoard(game),
    });
  },
};

export default command;
