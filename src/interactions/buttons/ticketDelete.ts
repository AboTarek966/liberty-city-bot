// ============================================
// Liberty City Bot - Ticket Delete Button
// ============================================

import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { Ticket } from '../../models';

const handler: ButtonHandler = {
  id: 'ticket_delete',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const ticket = await Ticket.findOne({ channelId: interaction.channelId });
      if (!ticket) {
        await interaction.editReply({ content: '❌ لم يتم العثور على تذكرة' });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isOwner = ticket.userId === interaction.user.id;
      const canManage = member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !canManage) {
        await interaction.editReply({ content: '❌ ليس لديك صلاحية لحذف هذه التذكرة' });
        return;
      }

      await interaction.editReply({ content: '🗑️ جارٍ حذف التذكرة...' });
      await client.ticketHandler.deleteTicket(interaction.channelId, member);
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
      });
    }
  },
};

export default handler;
