"use strict";
// ============================================
// Liberty City Bot - Ticket Reset (إعادة تعيين الطلب)
// يحذف تذكرتك المفتوحة حتى تتمكن من فتح تذكرة جديدة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
const handler = {
    id: 'ticket_reset',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const client = interaction.client;
        try {
            // البحث عن أي تذكرة مفتوحة لهذا العضو
            const openTicket = await models_1.Ticket.findOne({
                guildId: interaction.guild.id,
                userId: interaction.user.id,
                status: { $in: ['open', 'claimed', 'waiting'] },
            });
            if (!openTicket) {
                await interaction.editReply({
                    content: '✅ ليس لديك أي تذكرة مفتوحة — اختر نوع التذكرة من القائمة بالأسفل لفتح تذكرة جديدة.',
                });
                return;
            }
            // حذف قناة التذكرة
            const channel = interaction.guild.channels.cache.get(openTicket.channelId);
            if (channel) {
                await channel.delete('إعادة تعيين الطلب — بواسطة صاحب التذكرة').catch(() => { });
            }
            // تحديث حالة التذكرة في القاعدة
            openTicket.status = 'deleted';
            await openTicket.save();
            await interaction.editReply({
                content: '🔄 **تم إعادة تعيين طلبك** — تم حذف تذكرتك المفتوحة.\nيمكنك الآن فتح تذكرة جديدة من القائمة بالأسفل.',
            });
        }
        catch (error) {
            await interaction.editReply({ content: `❌ حدث خطأ: ${error.message}` }).catch(() => { });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketReset.js.map