// ============================================
// Liberty City Bot - Ticket Close Button
// ============================================

import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { Ticket } from '../../models';

const handler: ButtonHandler = {
  id: 'ticket_close',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const ticket = await Ticket.findOne({ channelId: interaction.channelId });
      if (!ticket) {
        await interaction.editReply({ content: '❌ لم يتم العثور على تذكرة في هذه القناة' });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isOwner = ticket.userId === interaction.user.id;
      const canManage = member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !canManage) {
        await interaction.editReply({ content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة' });
        return;
      }

      await client.ticketHandler.closeTicket(
        interaction.channelId,
        member,
        isOwner ? 'أُغلقت بواسطة صاحب التذكرة' : 'أُغلقت بواسطة المشرف'
      );

      await interaction.editReply({ content: '🔒 تم إغلاق التذكرة بنجاح' });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ أثناء إغلاق التذكرة'}`,
      });
    }
  },
};

export default handler;
