"use strict";
// ============================================
// Liberty City Bot - Ticket Call Admin Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const handler = {
    id: 'ticket_call_admin',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            await client.ticketHandler.callAdmin(interaction.channelId, member);
            await interaction.editReply({ content: '🔔 تم استدعاء الإدارة العليا!' });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketCallAdmin.js.map