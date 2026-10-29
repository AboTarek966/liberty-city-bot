"use strict";
// ============================================
// Liberty City Bot - Ticket Delete Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
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
            const isOwner = ticket.userId === interaction.user.id;
            const canManage = member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels);
            if (!isOwner && !canManage) {
                await interaction.editReply({ content: '❌ ليس لديك صلاحية لحذف هذه التذكرة' });
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