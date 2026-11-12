// ============================================
// Omni Bot - Ticket Close Modal Handler
// ============================================

import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { OmniClient } from '../../OmniClient';
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

      // التحقق من الصلاحيات — الإغلاق لفريق الدعم/الإدارة فقط
      const member = interaction.guild.members.cache.get(interaction.user.id) ??
        await interaction.guild.members.fetch(interaction.user.id);
      const client = interaction.client as OmniClient;

      if (!(await client.ticketHandler.isStaff(member))) {
        await interaction.followUp({ content: '❌ إغلاق التذاكر متاح لفريق الدعم والإدارة فقط', ephemeral: true });
        return;
      }

      const reason = interaction.fields.getTextInputValue('reason').trim() || 'غير محدد';

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