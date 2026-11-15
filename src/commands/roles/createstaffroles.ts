// ============================================
// Omni Bot - 👑 إنشاء رتب الإدارة + الفواصل (مرة واحدة / idempotent)
// /createstaffroles — نفس منطق الإنشاء التلقائي عند الإقلاع
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { createLogger } from '../../utils/helpers';
import { ensureStaffRoles, STAFF_ROLES } from '../../utils/staffRoles';

const logger = createLogger('StaffRoles');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('createstaffroles')
    .setDescription('👑 إنشاء رتب الإدارة + الفواصل بالترتيب (مرة واحدة — قابل للتكرار بأمان)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.guild) {
      await interaction.editReply({ content: '❌ يعمل في السيرفر فقط.' });
      return;
    }
    const member = interaction.guild.members.cache.get(interaction.user.id);
    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const isAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    if (!isOwner && !isAdmin) {
      await interaction.editReply({ content: '⛔ هذا الأمر لمالك السيرفر أو من يملك Administrator فقط.' });
      return;
    }

    const result = await ensureStaffRoles(interaction.guild);

    const orderLines = result.finalOrder
      .map((r, i) => `${String(i + 1).padStart(2, ' ')}. <@&${r.roleId}> \`${r.name}\``)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(result.skipped ? '👑 رتب الإدارة جاهزة بالفعل' : '👑 تم تجهيز رتب الإدارة')
      .addFields(
        { name: '🆕 تم إنشاؤها', value: result.created.length ? result.created.map((n) => `• ${n}`).join('\n').slice(0, 1024) : 'لا شيء (كانت موجودة)', inline: false },
        { name: '♻️ محدّثة', value: result.reused.length ? String(result.reused.length) : '0', inline: true },
        { name: '❌ فشلت', value: result.failed.length ? result.failed.join('\n').slice(0, 1024) : 'لا شيء ✅', inline: false },
        { name: '📈 أعلى رتبة للبوت', value: `\`${result.botHighestName}\` (#${result.botHighestPosition})`, inline: true },
        { name: '📋 الترتيب النهائي (من الأعلى)', value: orderLines.slice(0, 1024) || 'فارغ', inline: false }
      )
      .setDescription('الرتب الجديدة تحت رتبة البوت العليا مباشرة.\nلو عايز الرتب فوق بعضها في قائمة الأعضاء — ارفع رول البوت أعلى (من Server Settings → Roles).')
      .setFooter({ text: 'Made by Omni' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
