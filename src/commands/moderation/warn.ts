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
import { getGuildSettings } from '../../models';
import { offerWarnRoles } from '../../utils/warnRoles';

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

      await interaction.editReply({
        content: `⚠️ **${target.tag}** تم تحذيره (${result.warningCount} تحذير) | ${reason}`,
      });

      // 🎭 رولات التحذير — إعطاء مباشرة أو لوحة اختيار (من الإعدادات)
      const targetMember = await interaction.guild!.members.fetch(target.id).catch(() => null);
      if (targetMember) {
        const executor =
          interaction.guild!.members.cache.get(interaction.user.id) ||
          (await interaction.guild!.members.fetch(interaction.user.id).catch(() => null));
        if (executor) {
          await offerWarnRoles({
            settings: await getGuildSettings(interaction.guildId!),
            guild: interaction.guild!,
            executor,
            target: targetMember,
            reason,
            reply: payload =>
              interaction.followUp({
                content: payload.content,
                components: payload.components as any,
                ephemeral: true,
              }),
          });
        }
      }
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ حدث خطأ: ${error.message}`,
      });
    }
  },
};

export default command;