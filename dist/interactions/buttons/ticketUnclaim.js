"use strict";
// ============================================
// Omni Bot - Ticket Unclaim Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const botOwner_1 = require("../../utils/botOwner");
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
            const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
            const canUnclaim = (0, botOwner_1.isEnvBotOwner)(member.id) ||
                member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) ||
                member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels) ||
                (settings.tickets.adminRoleIds || []).some((id) => member.roles.cache.has(id)) ||
                (settings.tickets.supportRoleIds || []).some((id) => member.roles.cache.has(id));
            if (!canUnclaim) {
                await interaction.editReply({ content: '❌ تحتاج أن تكون من فريق الدعم أو الإدارة لإلغاء الاستلام' });
                return;
            }
            await client.ticketHandler.unclaimTicket(interaction.channelId, member);
            await interaction.editReply({
                content: '↩️ تم إلغاء استلام التذكرة — يمكن لأي إداري آخر استلامها الآن',
            });
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