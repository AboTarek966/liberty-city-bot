// ============================================
// Liberty City Bot - Ticket Close Modal Handler
// ============================================

import { ModalSubmitInteraction, PermissionFlagsBits } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { Ticket } from '../../models';

const handler: ModalHandler = {
  id: 'ticket_close_modal',
  async execute(interaction: ModalSubmitInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    try {
      const ticketId = interaction.customId.split(':')[1];
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        await interaction.followUp({ content: '❌ لم يتم العثور على التذكرة', ephemeral: true });
        return;
      }

      // التحقق من الصلاحيات
      const member = interaction.guild.members.cache.get(interaction.user.id) ??
        await interaction.guild.members.fetch(interaction.user.id);
      const isOwner = ticket.userId === interaction.user.id;
      const canManage = member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !canManage) {
        await interaction.followUp({ content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة', ephemeral: true });
        return;
      }

      const reason = interaction.fields.getTextInputValue('reason').trim() || 'غير محدد';

      const client = interaction.client as LibertyClient;
      await client.ticketHandler.closeTicket(ticket.channelId, member, reason);

      // لا نرد هنا لأن closeTicket ترسل رسالة في القناة مع الأزرار
    } catch (error: any) {
      await interaction.followUp({
        content: `❌ ${error.message || 'حدث خطأ أثناء إغلاق التذكرة'}`,
        ephemeral: true,
      });
    }
  },
};

export default handler;