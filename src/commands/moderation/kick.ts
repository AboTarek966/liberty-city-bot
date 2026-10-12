// ============================================
// Liberty City Bot - Kick Command
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
    .setName('kick')
    .setDescription('طرد عضو من السيرفر')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد طرده')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب الطرد')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.KickMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

    await interaction.deferReply({ ephemeral: true });

    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) {
      await interaction.editReply({
        content: '❌ العضو غير موجود في السيرفر',
      });
      return;
    }

    // Check if bot can kick
    if (!member.kickable) {
      await interaction.editReply({
        content: '❌ لا أستطيع طرد هذا العضو. تأكد أن رتبتي أعلى من رتبته',
      });
      return;
    }

    // Check if target is the owner
    if (target.id === interaction.guild?.ownerId) {
      await interaction.editReply({
        content: '❌ لا يمكنك طرد مالك السيرفر',
      });
      return;
    }

    // Check if target is the moderator themselves
    if (target.id === interaction.user.id) {
      await interaction.editReply({
        content: '❌ لا يمكنك طرد نفسك',
      });
      return;
    }

    try {
      const result = await client.moderationHandler.kick({
        guild: interaction.guild!,
        moderator: interaction.guild!.members.cache.get(interaction.user.id)!,
        target,
        reason,
      });

      await interaction.editReply({
        content: `👢 **${target.tag}** تم طرده | ${reason}`,
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ حدث خطأ: ${error.message}`,
      });
    }
  },
};

export default command;