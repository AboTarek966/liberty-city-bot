"use strict";
// ============================================
// Omni Bot - Ticket Delete Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
const handler = {
    id: 'ticket_delete',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            const ticket = await models_1.Ticket.findOne({ channelId: interaction.channelId });
            if (!ticket) {
                await interaction.editReply({ content: '❌ لم يتم العثور على تذكرة' });
                return;
            }
            // السماح بالحذف فقط للتذاكر المغلقة
            if (ticket.status !== 'closed') {
                await interaction.editReply({
                    content: '❌ لا يمكن حذف التذكرة إلا بعد إغلاقها — اضغط "إغلاق" أولاً'
                });
                return;
            }
            const member = interaction.guild.members.cache.get(interaction.user.id) ??
                await interaction.guild.members.fetch(interaction.user.id);
            // 🔐 الحذف النهائي لفريق الدعم/الإدارة فقط — صاحب التذكرة لا يحذفها
            if (!(await client.ticketHandler.isStaff(member))) {
                await interaction.editReply({ content: '❌ حذف التذاكر متاح لفريق الدعم والإدارة فقط' });
                return;
            }
            await interaction.editReply({ content: '🗑️ جارٍ حذف التذكرة...' });
            await client.ticketHandler.deleteTicket(interaction.channelId, member);
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketDelete.js.map