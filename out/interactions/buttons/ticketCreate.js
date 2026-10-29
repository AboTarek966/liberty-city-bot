"use strict";
// ============================================
// Liberty City Bot - Ticket Create Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const handler = {
    id: 'ticket_create',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
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
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ أثناء إنشاء التذكرة'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketCreate.js.map