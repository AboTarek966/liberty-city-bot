// ============================================
// Liberty City Bot - Untimeout Command (فك الكتم)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('إلغاء تايم أوت (فك كتم مؤقت)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName('user').setDescription('العضو المراد فك كتمه').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('السبب').setRequired(false)
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    const member = interaction.options.getMember('user') as GuildMember;
    const reason = interaction.options.getString('reason') || 'إلغاء تايم أوت';

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
      return;
    }

    if (!member.isCommunicationDisabled()) {
      await interaction.reply({ content: 'ℹ️ هذا العضو غير مكتوم أصلاً', ephemeral: true });
      return;
    }

    const executorMember = interaction.member as GuildMember;
    const isOwner = interaction.user.id === guild.ownerId;
    if (!isOwner && executorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
      return;
    }

    if (guild.members.me!.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
      return;
    }

    try {
      await member.timeout(null, `${reason} | بواسطة ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setTitle('🔓 تم فك الكتم')
        .setColor(Colors.success)
        .addFields(
          { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
          { name: '🛡️ المنفذ', value: `${interaction.user}`, inline: true },
          { name: '📝 السبب', value: reason, inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `Liberty City | ${guild.name}` });

      await interaction.reply({ embeds: [embed] });

      // Log
      try {
        const { getGuildSettings } = await import('../../models');
        const settings = await getGuildSettings(guild.id);
        if (settings.logging?.enabled && settings.logging.channelId) {
          const logChannel = guild.channels.cache.get(settings.logging.channelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🔓 إلغاء تايم أوت')
              .setColor(Colors.success)
              .addFields(
                { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                { name: '📝 السبب', value: reason, inline: false },
              )
              .setTimestamp();
            await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch {}
    } catch (error) {
      await interaction.reply({ content: '❌ فشل فك الكتم — تحقق من صلاحيات البوت', ephemeral: true });
    }
  },
};

export default command;