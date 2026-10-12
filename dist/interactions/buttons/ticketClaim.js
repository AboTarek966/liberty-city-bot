"use strict";
// ============================================
// Liberty City Bot - Ticket Claim Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const handler = {
    id: 'ticket_claim',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                await interaction.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات لاستلام التذاكر' });
                return;
            }
            await client.ticketHandler.claimTicket(interaction.channelId, member);
            await interaction.editReply({ content: '🤝 تم استلام التذكرة بنجاح' });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ أثناء استلام التذكرة'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketClaim.js.map