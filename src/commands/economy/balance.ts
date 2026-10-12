// ============================================
// Liberty City Bot - Balance Command (الرصيد)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { UserProfile } from '../../models';
import { formatNumber } from '../../utils/helpers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💰 عرض رصيدك — المحفظة والبنك')
    .addUserOption(option =>
      option.setName('user').setDescription('العضو (افتراضياً: أنت)').setRequired(false)
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') || interaction.user;

    const profile = await UserProfile.findOne({
      userId: target.id,
      guildId: interaction.guildId!,
    }).catch(() => null);

    const wallet = profile?.balance || 0;
    const bank = profile?.bank || 0;

    await interaction.reply({
      content: `💰 رصيد ${target.username} — 👛 ${formatNumber(wallet)} • 🏦 ${formatNumber(bank)} • 📊 ${formatNumber(wallet + bank)}`,
    });
  },
};

export default command;
