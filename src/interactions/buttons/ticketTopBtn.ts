// ============================================
// Liberty City Bot - Ticket Top Buttons
// customId: ttop|<period>|<page>[|<mark>]
//   mark: prev / next / r / p
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import {
  buildTicketTopPage,
  sanitizeTicketTopPeriod,
} from '../../utils/ticketTop';

const handler: ButtonHandler = {
  id: 'ttop',
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split('|');
    const period = sanitizeTicketTopPeriod(parts[1]);

    const rawPage = parseInt(parts[2], 10);
    let page = Number.isFinite(rawPage) ? rawPage : 1;

    const mark = parts[3] || '';
    if (mark === 'prev') page -= 1;
    else if (mark === 'next') page += 1;

    const result = await buildTicketTopPage(interaction.guild!, period, page);

    await interaction.editReply({ embeds: [result.embed], components: result.components });
  },
};

export default handler;
