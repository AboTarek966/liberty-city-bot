// ============================================
// Liberty City Bot - Ticket Transcript Button
// ============================================

import { ButtonInteraction, AttachmentBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';

const handler: ButtonHandler = {
  id: 'ticket_transcript',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      const transcript = await client.ticketHandler.getTranscript(interaction.channelId);
      const attachment = new AttachmentBuilder(
        Buffer.from(transcript, 'utf-8'),
        { name: `transcript-${interaction.channelId.slice(-6)}.txt` }
      );

      await interaction.editReply({
        content: '📄 نسخة المحادثة:',
        files: [attachment],
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
      });
    }
  },
};

export default handler;
