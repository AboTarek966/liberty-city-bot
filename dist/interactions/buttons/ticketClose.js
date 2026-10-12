"use strict";
// ============================================
// Liberty City Bot - Ticket Close Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const handler = {
    id: 'ticket_close',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            const ticket = await models_1.Ticket.findOne({ channelId: interaction.channelId });
            if (!ticket) {
                await interaction.editReply({ content: '❌ لم يتم العثور على تذكرة في هذه القناة' });
                return;
            }
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const isOwner = ticket.userId === interaction.user.id;
            const canManage = member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels);
            if (!isOwner && !canManage) {
                await interaction.editReply({ content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة' });
                return;
            }
            await client.ticketHandler.closeTicket(interaction.channelId, member, isOwner ? 'أُغلقت بواسطة صاحب التذكرة' : 'أُغلقت بواسطة المشرف');
            await interaction.editReply({ content: '🔒 تم إغلاق التذكرة بنجاح' });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ أثناء إغلاق التذكرة'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketClose.js.map