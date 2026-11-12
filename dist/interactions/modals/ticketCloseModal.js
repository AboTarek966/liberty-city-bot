"use strict";
// ============================================
// Omni Bot - Ticket Close Modal Handler
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
const handler = {
    id: 'ticket_close_modal',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        await interaction.deferUpdate();
        try {
            const ticketId = interaction.customId.split(':')[1];
            const ticket = await models_1.Ticket.findById(ticketId);
            if (!ticket) {
                await interaction.followUp({ content: '❌ لم يتم العثور على التذكرة', ephemeral: true });
                return;
            }
            // التحقق من الصلاحيات — الإغلاق لفريق الدعم/الإدارة فقط
            const member = interaction.guild.members.cache.get(interaction.user.id) ??
                await interaction.guild.members.fetch(interaction.user.id);
            const client = interaction.client;
            if (!(await client.ticketHandler.isStaff(member))) {
                await interaction.followUp({ content: '❌ إغلاق التذاكر متاح لفريق الدعم والإدارة فقط', ephemeral: true });
                return;
            }
            const reason = interaction.fields.getTextInputValue('reason').trim() || 'غير محدد';
            await client.ticketHandler.closeTicket(ticket.channelId, member, reason);
            // لا نرد هنا لأن closeTicket ترسل رسالة في القناة مع الأزرار
        }
        catch (error) {
            await interaction.followUp({
                content: `❌ ${error.message || 'حدث خطأ أثناء إغلاق التذكرة'}`,
                ephemeral: true,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketCloseModal.js.map