// ============================================
// Liberty City Bot - Ticket Unclaim Button
// ============================================

import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';

const handler: ButtonHandler = {
  id: 'ticket_unclaim',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await client.ticketHandler.unclaimTicket(interaction.channelId, member);
      await interaction.editReply({ content: '↩️ تم إلغاء استلام التذكرة' });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
      });
    }
  },
};

export default handler;
