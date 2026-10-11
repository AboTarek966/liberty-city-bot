// ============================================
// Liberty City Bot - RoleAdd Command (إضافة رول)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Role,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roleadd')
    .setDescription('إضافة رول لعضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('العضو المراد إضافة الرول له').setRequired(true)
    )
    .addRoleOption(o =>
      o.setName('role').setDescription('الرول المراد إضافته').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('السبب').setRequired(false)
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    const member = interaction.options.getMember('user') as GuildMember;
    const role = interaction.options.getRole('role', true) as Role;
    const reason = interaction.options.getString('reason') || 'إضافة رول';

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
      return;
    }

    // لا يمكن تعديل رولات مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
    if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكن تعديل رولات مالك السيرفر', ephemeral: true });
      return;
    }

    if (member.roles.cache.has(role.id)) {
      await interaction.reply({ content: `❌ العضو يملك رول ${role} بالفعل`, ephemeral: true });
      return;
    }

    const executorMember = interaction.member as GuildMember;
    const isOwner = interaction.user.id === guild.ownerId;
    if (!isOwner && executorMember.roles.highest.comparePositionTo(role) <= 0) {
      await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من الرول المضاف', ephemeral: true });
      return;
    }

    if (guild.members.me!.roles.highest.comparePositionTo(role) <= 0) {
      await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من الرول المضاف', ephemeral: true });
      return;
    }

    try {
      await member.roles.add(role, `${reason} | بواسطة ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setTitle('➕ تم إضافة الرول')
        .setColor(Colors.success)
        .addFields(
          { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
          { name: '🎭 الرول', value: `${role}`, inline: true },
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
              .setTitle('➕ إضافة رول')
              .setColor(Colors.success)
              .addFields(
                { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '🎭 الرول', value: `${role}`, inline: true },
                { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                { name: '📝 السبب', value: reason, inline: false },
              )
              .setTimestamp();
            await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch {}
    } catch (error) {
      await interaction.reply({ content: '❌ فشل إضافة الرول — تحقق من صلاحيات البوت', ephemeral: true });
    }
  },
};

export default command;