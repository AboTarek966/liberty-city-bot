"use strict";
// ============================================
// Omni Bot - متجر البروجيكتات (زر تم التسليم والاستلام)
// البائع/مدير المتجر فقط — يغلق الطلب ويزيد المبيعات ويرسل إيصال للمشتري
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
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
        order.status = 'paid';
        order.paidBy = interaction.user.id;
        order.paidAt = new Date();
        await order.save();
        // زيادة عداد المبيعات على البروجيكت
        const store = await (0, store_1.getStore)(false);
        const project = store && (0, store_1.findProject)(store, order.projectId);
        if (project) {
            project.sales = (project.sales || 0) + 1;
            await store.save().catch(() => { });
        }
        const confirmedEmbed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('✅ تم التسليم والاستلام')
            .setDescription([
            `📦 **البروجيكت:** ${order.projectName}`,
            `🧾 **الطلب:** #${order.orderId}`,
            `💰 **الصافي:** ${(0, store_1.formatCredits)(order.price)} كريديت`,
            `👤 **أكّد التسليم:** <@${interaction.user.id}>`,
            '',
            project ? `📊 إجمالي مبيعات هذا البروجيكت: **${project.sales}**` : null,
        ]
            .filter(Boolean)
            .join('\n'))
            .setTimestamp()
            .setFooter({ text: 'Omni Store • طلب مُغلق ومُوثّق' });
        await interaction.update({ embeds: [confirmedEmbed], components: [] }).catch(() => { });
        // إيصال الدفع للمشتري في الخاص
        try {
            const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
            if (buyer) {
                const receipt = new discord_js_1.EmbedBuilder()
                    .setColor(0x57f287)
                    .setTitle('🎉 وصل دفعك وتم التسليم — شكراً لك!')
                    .setDescription([
                    `📦 **البروجيكت:** ${order.projectName}`,
                    `🧾 **طلب:** #${order.orderId}`,
                    `💰 **المبلغ:** ${(0, store_1.formatCredits)(order.amount)} كريديت (صافي ${(0, store_1.formatCredits)(order.price)})`,
                    '',
                    'لو عندك أي استفسار عن البروجيكت بعد التسليم، تواصل مع البائع مباشرة.',
                ].join('\n'))
                    .setTimestamp()
                    .setFooter({ text: 'Omni Store • شكراً لثقتك' });
                await buyer.send({ embeds: [receipt] }).catch(() => { });
            }
        }
        catch {
            /* تجاهل */
        }
    },
};
exports.default = handler;
//# sourceMappingURL=storeConfirmSale.js.map