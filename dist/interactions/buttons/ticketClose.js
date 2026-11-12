"use strict";
// ============================================
// Omni Bot - Ticket Close Button
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
        try {
            const ticket = await models_1.Ticket.findOne({ channelId: interaction.channelId });
            if (!ticket) {
                await interaction.reply({ content: '❌ لم يتم العثور على تذكرة في هذه القناة', ephemeral: true });
                return;
            }
            // التحقق من الصلاحيات — الإغلاق لفريق الدعم/الإدارة فقط
            const member = interaction.guild.members.cache.get(interaction.user.id) ??
                await interaction.guild.members.fetch(interaction.user.id);
            if (!(await client.ticketHandler.isStaff(member))) {
                await interaction.reply({ content: '❌ إغلاق التذاكر متاح لفريق الدعم والإدارة فقط', ephemeral: true });
                return;
            }
            // إظهار Modal لكتابة السبب
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`ticket_close_modal:${ticket._id}`)
                .setTitle('🔒 إغلاق التذكرة');
            const reasonInput = new discord_js_1.TextInputBuilder()
                .setCustomId('reason')
                .setLabel('سبب الإغلاق (اختياري)')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('اكتب سبب الإغلاق هنا...')
                .setRequired(false)
                .setMaxLength(500);
            const row = new discord_js_1.ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
        }
        catch (error) {
            await interaction.reply({
                content: `❌ ${error.message || 'حدث خطأ'}`,
                ephemeral: true,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketClose.js.map