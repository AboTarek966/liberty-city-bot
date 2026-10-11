// ============================================
// Liberty City Bot - Unwarn Command (إزالة تحذير)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('إزالة تحذير من عضو')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد إزالة تحذيره')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب إزالة التحذير')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'إزالة تحذير';

    await interaction.deferReply({ ephemeral: true });

    const moderator = interaction.guild?.members.cache.get(interaction.user.id);

    // Owner bypass: المالك يمكنه إزالة تحذير حتى لو لم يكن لديه صلاحية ModerateMembers
    const isOwner = interaction.user.id === interaction.guild?.ownerId;
    if (!moderator && !isOwner) {
      await interaction.editReply({ content: '❌ لم يتم العثور على العضو' });
      return;
    }

    try {
      const result = await client.moderationHandler.unwarn({
        guild: interaction.guild!,
        moderator: moderator || (interaction.member as GuildMember),
        target,
        reason,
      });

      await interaction.editReply({
        content: `✅ **تم إزالة تحذير للعضو ${target} من قبل ${interaction.user}**\n📝 **السبب:** ${reason}\n📊 **التحذيرات المتبقية:** ${result.warningCount}`,
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ أثناء إزالة التحذير'}`,
      });
    }
  },
};

export default command;
