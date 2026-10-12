"use strict";
// ============================================
// Liberty City Bot - Ticket Reopen Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const handler = {
    id: 'ticket_reopen',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            const ticketId = interaction.customId.split(':')[1];
            const ticket = await models_1.Ticket.findById(ticketId);
            if (!ticket) {
                await interaction.editReply({ content: '❌ لم يتم العثور على التذكرة' });
                return;
            }
            // التحقق من الصلاحيات
            const member = interaction.guild.members.cache.get(interaction.user.id) ??
                await interaction.guild.members.fetch(interaction.user.id);
            const canManage = member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels);
            if (!canManage) {
                await interaction.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات لإعادة فتح التذكرة' });
                return;
            }
            if (ticket.status !== 'closed') {
                await interaction.editReply({ content: '❌ التذكرة غير مغلقة' });
                return;
            }
            await client.ticketHandler.reopenTicket(ticket.channelId, member);
            await interaction.editReply({ content: '🔓 تم إعادة فتح التذكرة بنجاح' });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketReopen.js.map