// ============================================
// Liberty City Bot - User Info Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('عرض معلومات عضو')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو (الافتراضي: أنت)')
        .setRequired(false)
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(target.id);

    const lines: string[] = [
      `${target.bot ? '🤖' : '👤'} **${target.tag}** — \`${target.id}\``,
      `📅 إنشاء الحساب: <t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
    ];

    if (member) {
      lines.push(
        `📥 انضم: ${
          member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
            : 'غير معروف'
        }`
      );
      lines.push(
        `🎭 أعلى رتبة: ${
          member.roles.highest.id !== interaction.guildId
            ? `${member.roles.highest}`
            : 'لا يوجد'
        } • أدوار [${member.roles.cache.size - 1}]`
      );

      // Add permissions summary
      const keyPerms = [];
      if (member.permissions.has('Administrator')) keyPerms.push('👑 مدير');
      if (member.permissions.has('ManageGuild')) keyPerms.push('⚙️ إدارة سيرفر');
      if (member.permissions.has('BanMembers')) keyPerms.push('🔨 حظر');
      if (member.permissions.has('KickMembers')) keyPerms.push('👢 طرد');
      if (member.permissions.has('ManageMessages')) keyPerms.push('💬 إدارة رسائل');

      if (keyPerms.length > 0) {
        lines.push(`🔑 ${keyPerms.join(' • ')}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`👤 معلومات: ${target.tag}`)
      .setColor(Colors.primary)
      .setThumbnail(target.displayAvatarURL({ size: 512 }))
      .setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;