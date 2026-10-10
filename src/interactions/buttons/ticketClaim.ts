// ============================================
// Liberty City Bot - Ticket Claim Button
// ============================================

import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';

const handler: ButtonHandler = {
  id: 'ticket_claim',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);

      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات لاستلام التذاكر' });
        return;
      }

      await client.ticketHandler.claimTicket(interaction.channelId, member);

      await interaction.editReply({ content: '🤝 تم استلام التذكرة بنجاح' });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ أثناء استلام التذكرة'}`,
      });
    }
  },
};

export default handler;
