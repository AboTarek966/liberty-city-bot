"use strict";
// ============================================
// Omni Bot - متجر البروجيكتات (زر إلغاء الطلب)
// المشتري (طلبه) أو البائع/مدير المتجر يقدر يلغي
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const models_1 = require("../../models");
const handler = {
    id: 'store:cancelsale',
    async execute(interaction) {
        const orderId = interaction.customId.split(':')[2];
        const order = await models_1.StoreOrder.findOne({ orderId });
        if (!order) {
            await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
            return;
        }
        const isBuyer = order.buyerId === interaction.user.id;
        const isPayee = !!order.payeeId && order.payeeId === interaction.user.id;
        const isStaff = await (0, store_1.canManageStore)(interaction.client, interaction.user.id);
        if (!isBuyer && !isPayee && !isStaff) {
            await interaction.reply({
                content: '⛔ هذا الزر للمشتري أو البائع أو من يدير المتجر فقط.',
                ephemeral: true,
            });
            return;
        }
        if (order.status !== 'pending') {
            await interaction.reply({ content: 'ℹ️ هذا الطلب لم يعد قيد المعالجة', ephemeral: true });
            return;
        }
        order.status = 'cancelled';
        await order.save();
        const cancelledEmbed = new discord_js_1.EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('❌ تم إلغاء الطلب')
            .setDescription([
            `📦 **البروجيكت:** ${order.projectName}`,
            `🧾 **الطلب:** #${order.orderId} — أُلغي بواسطة <@${interaction.user.id}>`,
            `💰 **المبلغ:** ${(0, store_1.formatCredits)(order.amount)} كريديت (لم يتم خصم أي شيء بعد التأكيد)`,
        ].join('\n'))
            .setTimestamp()
            .setFooter({ text: 'Omni Store • الطلب ملغى' });
        await interaction.update({ embeds: [cancelledEmbed], components: [] }).catch(() => { });
        // إشعار المشتري إنه ألغى/أُلغي طلبه
        try {
            const isOwnCancel = isBuyer;
            const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
            if (buyer) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(0xed4245)
                    .setTitle(isOwnCancel ? '✅ تم إلغاء طلبك' : '⚠️ تم إلغاء طلب شراء')
                    .setDescription(isOwnCancel
                    ? `طلبك لـ«${order.projectName}» (#${order.orderId}) أُلغي بنجاح. لو كنت دفعت بالفعل راجع البائع.`
                    : `تم إلغاء طلبك لـ«${order.projectName}» (#${order.orderId}) بواسطة البائع/الإدارة. إن كنت دفعت، راجعهم لمعالجة المبلغ.`)
                    .setTimestamp();
                await buyer.send({ embeds: [embed] }).catch(() => { });
            }
        }
        catch {
            /* تجاهل */
        }
    },
};
exports.default = handler;
//# sourceMappingURL=storeCancelSale.js.map