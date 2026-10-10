// ============================================
// Liberty City Bot - Avatar Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('عرض صورة الأفاتار')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو (الافتراضي: أنت)')
        .setRequired(false)
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') || interaction.user;

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ صورة ${target.tag}`)
      .setColor(Colors.primary)
      .setImage(target.displayAvatarURL({ size: 4096 }))
      .addFields(
        {
          name: '🔗 رابط PNG',
          value: `[اضغط هنا](${target.displayAvatarURL({ size: 4096, extension: 'png' })})`,
          inline: true,
        },
        {
          name: '🔗 رابط WebP',
          value: `[اضغط هنا](${target.displayAvatarURL({ size: 4096, extension: 'webp' })})`,
          inline: true,
        },
        {
          name: '🔗 رابط GIF',
          value: target.avatar?.startsWith('a_')
            ? `[اضغط هنا](${target.displayAvatarURL({ size: 4096, extension: 'gif' })})`
            : 'غير متاح (ليست متحركة)',
          inline: true,
        },
      )
      .setFooter({ text: 'Liberty City Bot' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;