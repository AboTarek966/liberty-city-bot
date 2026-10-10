// ============================================
// Liberty City Bot - Ticket Create Button
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';

const handler: ButtonHandler = {
  id: 'ticket_create',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const panelId = interaction.customId.replace('ticket_create_', '');

      const ticket = await client.ticketHandler.createTicket({
        guild: interaction.guild,
        user: member,
        type: 'عام',
        panelId,
      });

      await interaction.editReply({
        content: `✅ تم إنشاء تذكرتك بنجاح: <#${ticket.channelId}>`,
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ أثناء إنشاء التذكرة'}`,
      });
    }
  },
};

export default handler;
