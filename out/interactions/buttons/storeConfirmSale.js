"use strict";
// ============================================
// Omni Bot - 🛍️ متجر Omni (زر تم التسليم والاستلام)
// البائع/مدير المتجر فقط — يغلق الطلب ويزيد المبيعات ويرسل إيصال للمشتري
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const storeFulfill_1 = require("../../utils/storeFulfill");
const models_1 = require("../../models");
const handler = {
    id: 'store:confirmsale',
    async execute(interaction) {
        const orderId = interaction.customId.split(':')[2];
        const order = await models_1.StoreOrder.findOne({ orderId });
        if (!order) {
            await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
            return;
        }
        const isPayee = !!order.payeeId && order.payeeId === interaction.user.id;
        const isStaff = await (0, store_1.canManageStore)(interaction.client, interaction.user.id);
        if (!isPayee && !isStaff) {
            await interaction.reply({
                content: '⛔ هذا الزر لبائع الطلب أو من يدير المتجر فقط.',
                ephemeral: true,
            });
            return;
        }
        if (order.status !== 'pending') {
            await interaction.reply({ content: 'ℹ️ هذا الطلب تم إتمامه مسبقاً', ephemeral: true });
            return;
        }
        const result = await (0, storeFulfill_1.fulfillStoreOrder)(interaction.client, {
            mode: 'manual',
            orderId: order.orderId,
            guild: interaction.guild ?? null,
            actorLabel: interaction.user.id,
            notifyLog: false,
        });
        if (!result.claimed) {
            await interaction.reply({ content: 'ℹ️ هذا الطلب تم إتمامه مسبقاً', ephemeral: true });
            return;
        }
        const store = await (0, store_1.getStore)(false).catch(() => null);
        const project = store && (0, store_1.findProject)(store, order.projectId);
        const meta = (0, store_1.storeTypeMeta)(order.itemType ?? project?.type);
        const emoji = order.itemEmoji || (project ? (0, store_1.storeItemEmoji)(project) : meta.emoji);
        const confirmedEmbed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('✅ تم التسليم والاستلام')
            .setDescription([
            `${emoji} **العنصر:** ${order.projectName}`,
            `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
            `🧾 **الطلب:** #${order.orderId}`,
            `💰 **الصافي:** ${(0, store_1.formatCredits)(order.price)} كريديت`,
            `👤 **أكّد التسليم:** <@${interaction.user.id}>`,
            '',
            result.totalSales !== undefined ? `📊 إجمالي مبيعات هذا العنصر: **${result.totalSales}**` : null,
            result.stockLine,
            result.roleLine,
        ]
            .filter(Boolean)
            .join('\n'))
            .setTimestamp()
            .setFooter({ text: 'Omni Store • طلب مُغلق ومُوثّق' });
        await interaction.update({ embeds: [confirmedEmbed], components: [] }).catch(() => { });
    },
};
exports.default = handler;
//# sourceMappingURL=storeConfirmSale.js.map