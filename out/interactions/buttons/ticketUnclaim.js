"use strict";
// ============================================
// Liberty City Bot - Ticket Unclaim Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const handler = {
    id: 'ticket_unclaim',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            // ⚡ الكاش أولاً — تجنّب طلب شبكة إضافي قبل الرد
            const member = interaction.guild.members.cache.get(interaction.user.id) ??
                (await interaction.guild.members.fetch(interaction.user.id));
            await client.ticketHandler.unclaimTicket(interaction.channelId, member);
            await interaction.editReply({ content: '↩️ تم إلغاء استلام التذكرة' });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketUnclaim.js.map