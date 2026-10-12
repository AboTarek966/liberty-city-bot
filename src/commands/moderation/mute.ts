// ============================================
// Liberty City Bot - Mute Command (Role-based)
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
    .setName('mute')
    .setDescription('كتم عضو باستخدام رول الكتم')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد كتمه')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب الكتم')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('مدة الكتم (مثال: 10m, 1h, 1d) — اختياري')
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
    const duration = interaction.options.getString('duration') || undefined;

    await interaction.deferReply({ ephemeral: true });

    if (target.id === interaction.user.id) {
      await interaction.editReply({ content: '❌ لا يمكنك كتم نفسك' });
      return;
    }

    const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
      return;
    }

    try {
      const moderator = await interaction.guild!.members.fetch(interaction.user.id);
      const result = await client.moderationHandler.mute({
        guild: interaction.guild!,
        moderator,
        target: member,
        reason,
        duration,
      });

      await interaction.editReply({ content: result.simpleMsg });
    } catch (error: any) {
      await interaction.editReply({ content: `❌ حدث خطأ: ${error.message}` });
    }
  },
};

export default command;
