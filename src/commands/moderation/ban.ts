// ============================================
// Liberty City Bot - Ban Command
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
    .setName('ban')
    .setDescription('حظر عضو من السيرفر')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد حظره')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب الحظر')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Get target member
    const member = interaction.guild?.members.cache.get(target.id);

    // Check if bot can ban
    if (member && !member.bannable) {
      await interaction.editReply({
        content: '❌ لا أستطيع حظر هذا العضو. تأكد أن رتبتي أعلى من رتبته',
      });
      return;
    }

    // Check if target is the owner
    if (target.id === interaction.guild?.ownerId) {
      await interaction.editReply({
        content: '❌ لا يمكنك حظر مالك السيرفر',
      });
      return;
    }

    // Check if target is the moderator themselves
    if (target.id === interaction.user.id) {
      await interaction.editReply({
        content: '❌ لا يمكنك حظر نفسك',
      });
      return;
    }

    try {
      const result = await client.moderationHandler.ban({
        guild: interaction.guild!,
        moderator: interaction.guild!.members.cache.get(interaction.user.id)!,
        target,
        reason,
      });

      await interaction.editReply({
        content: `🔨 **${target.tag}** تم حظره | ${reason}`,
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ حدث خطأ: ${error.message}`,
      });
    }
  },
};

export default command;