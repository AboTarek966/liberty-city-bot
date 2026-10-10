// ============================================
// Liberty City Bot - Autorole Command
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
import { getGuildSettings } from '../../models';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('🎖️ الرول التلقائي — يُعطى تلقائياً لكل عضو جديد')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('تعيين رول تلقائي للأعضاء الجدد')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('الرول الذي سيُعطى تلقائياً')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('off')
        .setDescription('إيقاف الرول التلقائي')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('عرض حالة الرول التلقائي')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const subcommand = interaction.options.getSubcommand();
    const settings = await getGuildSettings(interaction.guildId!);

    await interaction.deferReply({ ephemeral: true });

    if (subcommand === 'set') {
      const role = interaction.options.getRole('role', true);

      const member = interaction.guild!.members.cache.get(client.user!.id);
      if (member && role.position >= member.roles.highest.position) {
        await interaction.editReply({
          content: '❌ لا يمكن استخدام رول أعلى من رتبة البوت! اختر رولاً أدناه.',
        });
        return;
      }

      settings.autorole.enabled = true;
      settings.autorole.roleId = role.id;
      await settings.save();

      const embed = new EmbedBuilder()
        .setTitle('✅ تم تفعيل الرول التلقائي')
        .setColor(Colors.success)
        .setDescription(
          `${role} سيُعطى تلقائياً لكل عضو جديد ينضم للسيرفر 🎉\n\n` +
          `جرّب بإنشاء حساب جديد أو اطلب من أحد الانضمام!`
        )
        .setFooter({ text: 'Liberty City Autorole' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'off') {
      settings.autorole.enabled = false;
      await settings.save();

      await interaction.editReply({ content: '✅ تم إيقاف الرول التلقائي' });
      return;
    }

    // status
    const roleId = settings.autorole?.roleId;
    const role = roleId ? interaction.guild!.roles.cache.get(roleId) : null;

    const embed = new EmbedBuilder()
      .setTitle('🎖️ حالة الرول التلقائي')
      .setColor(settings.autorole?.enabled ? Colors.success : Colors.error)
      .addFields(
        {
          name: '⚡ الحالة',
          value: settings.autorole?.enabled ? '✅ مفعّل' : '❌ معطّل',
          inline: true,
        },
        {
          name: '📛 الرول',
          value: role ? `${role}` : roleId ? `\`${roleId}\` (محذوف)` : 'غير محدد',
          inline: true,
        },
      )
      .setFooter({ text: 'Liberty City Autorole' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
