// ============================================
// Liberty City Bot - Warn Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('تحذير عضو')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد تحذيره')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب التحذير')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    await interaction.deferReply({ ephemeral: true });

    const member = interaction.guild?.members.cache.get(target.id);

    // Check if target is the moderator themselves
    if (target.id === interaction.user.id) {
      await interaction.editReply({
        content: '❌ لا يمكنك تحذير نفسك',
      });
      return;
    }

    try {
      const result = await client.moderationHandler.warn({
        guild: interaction.guild!,
        moderator: interaction.guild!.members.cache.get(interaction.user.id)!,
        target,
        reason,
      });

      const embed = result.embed;
      embed.addFields({
        name: '📊 عدد التحذيرات',
        value: `${result.warningCount}`,
        inline: true,
      });

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ حدث خطأ: ${error.message}`,
      });
    }
  },
};

export default command;