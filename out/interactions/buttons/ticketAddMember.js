"use strict";
// ============================================
// Liberty City Bot - Ticket Add Member Button (Modal)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const handler = {
    id: 'ticket_add_member',
    async execute(interaction) {
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId('ticket_add_member_modal')
            .setTitle('إضافة عضو للتذكرة')
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
            .setCustomId('member_id')
            .setLabel('معرّف العضو أو المنشن')
            .setPlaceholder('مثال: 123456789 أو @username')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)));
        await interaction.showModal(modal);
    },
};
exports.default = handler;
//# sourceMappingURL=ticketAddMember.js.map