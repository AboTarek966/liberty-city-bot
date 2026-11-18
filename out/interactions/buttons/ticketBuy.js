"use strict";
// ============================================
// Omni Bot - زر الشراء داخل التذكرة
// متاح لصاحب التذكرة فقط — لكن الرد يكون ظاهر للكل في قناة التذكرة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
const store_1 = require("../../utils/store");
const handler = {
    id: 'ticket_buy',
    async execute(interaction) {
        if (!interaction.guild || !interaction.channel) {
            await interaction.reply({ content: '❌ يعمل في قناة التذكرة فقط', ephemeral: true });
            return;
        }
        const settings = await (0, models_1.getGuildSettings)(interaction.guild.id).catch(() => null);
        if (!settings?.tickets?.buyButtonEnabled) {
            await interaction.reply({
                content: '❌ زر الشراء غير مفعّل حالياً — فعّله الأدمن من `/settings` ← التذاكر.',
                ephemeral: true,
            });
            return;
        }
        const ticket = await models_1.Ticket.findOne({
            guildId: interaction.guild.id,
            channelId: interaction.channel.id,
            status: { $in: ['open', 'claimed', 'waiting'] },
        })
            .lean()
            .catch(() => null);
        if (!ticket) {
            await interaction.reply({ content: '❌ هذه القناة ليست قناة تذكرة نشطة.', ephemeral: true });
            return;
        }
        // 🔒 الزر لصاحب التذكرة فقط — الباقي يتفرج بس
        if (String(ticket.userId) !== interaction.user.id) {
            await interaction.reply({
                content: '⛔ هذا الزر لصاحب التذكرة فقط — لكن تقدر تتفرج على التفاصيل اللي طلعتها.',
                ephemeral: true,
            });
            return;
        }
        // 🛍️ ردّ عام يظهر للكل في التذكرة (مش ephemeral)
        await interaction.deferReply({ ephemeral: false });
        const store = await (0, store_1.getStore)();
        if (!store) {
            await interaction.editReply({
                content: '❌ تعذر فتح المتجر حالياً — حاول لاحقاً.',
            });
            return;
        }
        const components = (0, store_1.buildStoreComponents)(store);
        const embed = (0, store_1.buildStoreEmbed)(store);
        if (!components.length) {
            await interaction.editReply({
                content: '🛍️ **المتجر فارغ حالياً** — ما في عناصر متاحة للبيع الآن.',
                embeds: [embed],
            });
            return;
        }
        embed.setFooter({ text: 'Omni Store • اختر العنصر من القائمة — الرد ظاهر للكل' });
        await interaction.editReply({ embeds: [embed], components });
    },
};
exports.default = handler;
//# sourceMappingURL=ticketBuy.js.map