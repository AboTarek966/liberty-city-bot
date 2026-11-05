"use strict";
// ============================================
// Omni Bot - Ticket Claim Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const handler = {
    id: 'ticket_claim',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            // ⚡ الكاش أولاً — تجنّب طلب شبكة إضافي قبل الرد
            const member = interaction.guild.members.cache.get(interaction.user.id) ??
                (await interaction.guild.members.fetch(interaction.user.id));
            const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
            const canClaim = member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) ||
                member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels) ||
                (settings.tickets.adminRoleIds || []).some((id) => member.roles.cache.has(id)) ||
                (settings.tickets.supportRoleIds || []).some((id) => member.roles.cache.has(id));
            if (!canClaim) {
                await interaction.editReply({ content: '❌ تحتاج أن تكون من فريق الدعم أو الإدارة لاستلام التذاكر' });
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