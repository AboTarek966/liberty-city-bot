// ============================================
// Liberty City Bot - Timeout Command
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
    .setName('timeout')
    .setDescription('كتم عضو مؤقتاً')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد كتمه')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('مدة الكتم (مثال: 10m, 1h, 1d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب الكتم')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user', true);
    const duration = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

    await interaction.deferReply({ ephemeral: true });

    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) {
      await interaction.editReply({
        content: '❌ العضو غير موجود في السيرفر',
      });
      return;
    }

    // Check if bot can moderate
    if (!member.moderatable) {
      await interaction.editReply({
        content: '❌ لا أستطيع كتم هذا العضو. تأكد أن رتبتي أعلى من رتبته',
      });
      return;
    }

    // Check if target is the moderator themselves
    if (target.id === interaction.user.id) {
      await interaction.editReply({
        content: '❌ لا يمكنك كتم نفسك',
      });
      return;
    }

    try {
      const result = await client.moderationHandler.timeout({
        guild: interaction.guild!,
        moderator: interaction.guild!.members.cache.get(interaction.user.id)!,
        target,
        reason,
        duration,
      });

      await interaction.editReply({
        embeds: [result.embed],
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ حدث خطأ: ${error.message}`,
      });
    }
  },
};

export default command;