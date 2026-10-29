"use strict";
// ============================================
// Liberty City Bot - Ticket Close Modal Handler
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
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
            // التحقق من الصلاحيات
            const member = interaction.guild.members.cache.get(interaction.user.id) ??
                await interaction.guild.members.fetch(interaction.user.id);
            const isOwner = ticket.userId === interaction.user.id;
            const canManage = member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels);
            if (!isOwner && !canManage) {
                await interaction.followUp({ content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة', ephemeral: true });
                return;
            }
            const reason = interaction.fields.getTextInputValue('reason').trim() || 'غير محدد';
            const client = interaction.client;
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