// ============================================
// Liberty City Bot - Settings Command (UI Panel)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { buildPanel, canManageSettings } from '../../utils/settingsPanel';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('🎛️ لوحة إعدادات السيرفر — واجهة سهلة وجميلة لكل الإعدادات')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!canManageSettings(interaction)) {
      await interaction.reply({
        content: '❌ تحتاج صلاحية **إدارة السيرفر** لفتح الإعدادات',
        ephemeral: true,
      });
      return;
    }

    const panel = await buildPanel('home', interaction.guild!, interaction.user.id);

    await interaction.reply({
      embeds: panel.embeds,
      components: panel.components as any,
      ephemeral: true,
    });
  },
};

export default command;
