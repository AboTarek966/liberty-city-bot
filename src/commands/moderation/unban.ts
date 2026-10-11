// ============================================
// Liberty City Bot - Unban Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('إلغاء حظر عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o =>
      o.setName('user').setDescription('العضو المراد إلغاء حظره').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('السبب').setRequired(false)
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'إلغاء حظر';

    try {
      await guild.members.unban(user.id, `${reason} | بواسطة ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setTitle('🔓 تم إلغاء الحظر')
        .setColor(Colors.success)
        .addFields(
          { name: '👤 العضو', value: `${user} (\`${user.id}\`)`, inline: true },
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
              .setTitle('🔓 إلغاء حظر')
              .setColor(Colors.success)
              .addFields(
                { name: '👤 العضو', value: `${user} (\`${user.id}\`)`, inline: true },
                { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                { name: '📝 السبب', value: reason, inline: false },
              )
              .setTimestamp();
            await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch {}
    } catch (error) {
      await interaction.reply({ content: '❌ فشل إلغاء الحظر — المستخدم غير محظور أو صلاحيات البوت', ephemeral: true });
    }
  },
};

export default command;