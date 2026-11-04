// ============================================
// Omni Bot - AI Ticket Assistant Admin Approval
// ============================================
// معالج أزرار موافقة/رفض الأدمن لإجراءات الـ AI في التذاكر
// الصيغة: ticket_ai:approve:<approvalId> | deny | details
// الموافقات محفوظة في MongoDB — تعمل بعد إعادة تشغيل البوت.

import {
  ButtonInteraction,
  GuildMember,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { OmniClient } from '../../OmniClient';
import { createLogger } from '../../utils/helpers';
import { getGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';

const logger = createLogger('Button:TicketAIApproval');

function buildDisabledRow(approvalId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_ai:approve:${approvalId}`)
      .setLabel('✅ موافقة')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`ticket_ai:deny:${approvalId}`)
      .setLabel('❌ رفض')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`ticket_ai:details:${approvalId}`)
      .setLabel('📋 تفاصيل')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

const handler: ButtonHandler = {
  id: 'ticket_ai',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const parts = interaction.customId.split(':');
    if (parts.length < 3) {
      await interaction.reply({ content: '❌ زر غير صالح', ephemeral: true });
      return;
    }

    const action = parts[1]; // approve, deny, details
    const approvalId = parts.slice(2).join(':');

    if (!['approve', 'deny', 'details'].includes(action)) {
      await interaction.reply({ content: '❌ إجراء غير معروف', ephemeral: true });
      return;
    }

    // --------------------------------------------
    // فحص صلاحية المستخدم
    // --------------------------------------------
    const member = interaction.member as GuildMember;
    const settings = await getGuildSettings(interaction.guild.id);
    const adminRoleIds = settings.tickets?.adminRoleIds || [];
    const supportRoleIds = settings.tickets?.supportRoleIds || [];

    const hasPermission =
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      adminRoleIds.some(id => member.roles.cache.has(id)) ||
      supportRoleIds.some(id => member.roles.cache.has(id));

    if (!hasPermission) {
      await interaction.reply({
        content: '❌ هذا الإجراء للإدارة فقط — تحتاج صلاحية إدارة السيرفر أو أحد رولات الإدارة.',
        ephemeral: true,
      });
      return;
    }

    const client = interaction.client as OmniClient;
    const assistant = client.aiTicketAssistant;

    // --------------------------------------------
    // 📋 تفاصيل الطلب
    // --------------------------------------------
    if (action === 'details') {
      const details = await assistant.getApprovalDetails(approvalId);
      if (!details) {
        await interaction.reply({ content: '❌ لم أجد طلب الموافقة', ephemeral: true });
        return;
      }
      if (details.guildId !== interaction.guild.id) {
        await interaction.reply({ content: '❌ طلب الموافقة لا يخص هذا السيرفر', ephemeral: true });
        return;
      }

      const statusLabels: Record<string, string> = {
        pending: '⏳ قيد الانتظار',
        approved: '✅ تمت الموافقة',
        denied: '❌ مرفوض',
        expired: '⏰ منتهي',
      };

      const embed = new EmbedBuilder()
        .setTitle('📋 تفاصيل طلب موافقة AI')
        .setColor(details.status === 'approved' ? Colors.success : details.status === 'denied' ? Colors.error : Colors.info)
        .addFields(
          { name: '🆔 الطلب', value: `\`${details.approvalId}\``, inline: false },
          { name: '🎫 التذكرة', value: `\`${details.ticketId}\``, inline: true },
          { name: '📌 الحالة', value: statusLabels[details.status] || details.status, inline: true },
          { name: '⚡ نوع الإجراء', value: `\`${details.action.type}\``, inline: true },
          { name: '📝 الوصف', value: details.action.description || '—', inline: false },
          {
            name: '📦 المعطيات',
            value: `\`\`\`json\n${JSON.stringify(details.action.params || {}, null, 2).slice(0, 900)}\n\`\`\``,
            inline: false,
          },
          {
            name: '👤 الهدف',
            value: details.action.targetUserId
              ? `<@${details.action.targetUserId}>`
              : details.action.targetRoleId
                ? `<@&${details.action.targetRoleId}>`
                : 'صاحب التذكرة',
            inline: true,
          },
          {
            name: '⏰ ينتهي',
            value: `<t:${Math.floor(new Date(details.expiresAt).getTime() / 1000)}:R>`,
            inline: true
          }
        )
        .setFooter({ text: `${interaction.guild!.name} • AI Ticket Assistant` })
        .setTimestamp();

      if (details.approvedBy) {
        embed.addFields({
          name: '👑 بواسطة',
          value: `<@${details.approvedBy}>`,
          inline: true,
        });
      }
      if (details.resultMessage) {
        embed.addFields({ name: '📤 النتيجة', value: details.resultMessage.slice(0, 1000), inline: false });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // --------------------------------------------
    // ✅ موافقة / ❌ رفض
    // --------------------------------------------
    await interaction.deferReply({ ephemeral: true });

    const approve = action === 'approve';
    const result = await assistant.handleAdminResponse(
      approvalId,
      interaction.user.id,
      approve,
      interaction.guild.id
    );

    await interaction.editReply({ content: result.message });

    // تعطيل أزرار الرسالة الأصلية بعد المعالجة
    try {
      await interaction.message.edit({ components: [buildDisabledRow(approvalId)] });
    } catch {
      /* الرسالة قد تكون محذوفة */
    }

    logger.info(
      `AI approval ${approvalId} ${approve ? 'approved' : 'denied'} by ${interaction.user.tag} — ok=${result.ok}`
    );
  },
};

export default handler;
