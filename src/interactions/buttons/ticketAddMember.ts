// ============================================
// Liberty City Bot - Ticket Add Member Button (Modal)
// ============================================

import {
  ButtonInteraction,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';

const handler: ButtonHandler = {
  id: 'ticket_add_member',
  async execute(interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
      .setCustomId('ticket_add_member_modal')
      .setTitle('إضافة عضو للتذكرة')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('member_id')
            .setLabel('معرّف العضو أو المنشن')
            .setPlaceholder('مثال: 123456789 أو @username')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  },
};

export default handler;
