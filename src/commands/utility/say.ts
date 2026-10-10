// ============================================
// Liberty City Bot - Say Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('إرسال نص باسم البوت')
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('النص المراد إرساله')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString('text', true);

    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    // إرسال النص مباشرة (بدون رد على الأمر حتى لا يظهر المنشن)
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '✅ تم الإرسال', ephemeral: true });
    }

    const channel: any = interaction.channel;
    if (channel && typeof channel.send === 'function') {
      await channel.send({ content: text }).catch(() => {});
    }
  },
};

export default command;
