"use strict";
// ============================================
// Liberty City Bot - Ticket Top Buttons
// customId: ttop|<period>|<page>[|<mark>]
//   mark: prev / next / r / p
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const ticketTop_1 = require("../../utils/ticketTop");
const handler = {
    id: 'ttop',
    async execute(interaction) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('|');
        const period = (0, ticketTop_1.sanitizeTicketTopPeriod)(parts[1]);
        const rawPage = parseInt(parts[2], 10);
        let page = Number.isFinite(rawPage) ? rawPage : 1;
        const mark = parts[3] || '';
        if (mark === 'prev')
            page -= 1;
        else if (mark === 'next')
            page += 1;
        const result = await (0, ticketTop_1.buildTicketTopPage)(interaction.guild, period, page);
        await interaction.editReply({ embeds: [result.embed], components: result.components });
    },
};
exports.default = handler;
//# sourceMappingURL=ticketTopBtn.js.map