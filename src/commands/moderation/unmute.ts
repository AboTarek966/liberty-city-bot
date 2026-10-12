// ============================================
// Liberty City Bot - Unmute Command
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
    .setName('unmute')
    .setDescription('إلغاء كتم عضو')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد إلغاء كتمه')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب إلغاء الكتم')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';

    await interaction.deferReply({ ephemeral: true });

    const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
      return;
    }

    try {
      const moderator = await interaction.guild!.members.fetch(interaction.user.id);
      const result = await client.moderationHandler.unmute({
        guild: interaction.guild!,
        moderator,
        target: member,
        reason,
      });

      await interaction.editReply({ content: result.simpleMsg });
    } catch (error: any) {
      await interaction.editReply({ content: `❌ حدث خطأ: ${error.message}` });
    }
  },
};

export default command;
