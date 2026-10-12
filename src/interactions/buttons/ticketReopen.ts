// ============================================
// Liberty City Bot - Ticket Reopen Button
// ============================================

import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { Ticket } from '../../models';

const handler: ButtonHandler = {
  id: 'ticket_reopen',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const ticketId = interaction.customId.split(':')[1];
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        await interaction.editReply({ content: '❌ لم يتم العثور على التذكرة' });
        return;
      }

      // التحقق من الصلاحيات
      const member = interaction.guild.members.cache.get(interaction.user.id) ??
        await interaction.guild.members.fetch(interaction.user.id);
      const canManage = member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!canManage) {
        await interaction.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات لإعادة فتح التذكرة' });
        return;
      }

      if (ticket.status !== 'closed') {
        await interaction.editReply({ content: '❌ التذكرة غير مغلقة' });
        return;
      }

      await client.ticketHandler.reopenTicket(ticket.channelId, member);

      await interaction.editReply({ content: '🔓 تم إعادة فتح التذكرة بنجاح' });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
      });
    }
  },
};

export default handler;