"use strict";
// ============================================
// Omni Bot - متجر البروجيكتات (زر / دفعت وطلب التسليم)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const models_1 = require("../../models");
/** بناء بطاقة الطلب المرسلة للبائع/قناة السجل */
function buildOrderCard(order, prefix, payeeId) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🛒 طلب شراء جديد — #${order.orderId}`)
        .setDescription([
        `📦 **البروجيكت:** ${order.projectName}`,
        `👤 **المشتري:** <@${order.buyerId}> (\`${order.buyerId}\`)`,
        `💰 **السعر الصافي:** ${(0, store_1.formatCredits)(order.price)}`,
        `🧾 **المطلوب تحويله:** ${(0, store_1.formatCredits)(order.amount)} (بعد خصم ProBot ${order.taxPercent ?? 5}%)`,
        payeeId ? `💳 **أمر الدفع:** \`${prefix}pay @${payeeId} ${order.amount}\`` : null,
        '',
        '> 🔔 العميل يؤكد أنه دفع — راجع التحويل، وبعد ما يصلك الصافي اضغط **تم التسليم والاستلام**.',
    ]
        .filter(Boolean)
        .join('\n'))
        .setFooter({ text: 'Omni Store • إيصال طلب — الحفظ في سجل الطلبات' })
        .setTimestamp();
}
const handler = {
    id: 'store:paid',
    async execute(interaction) {
        const orderId = interaction.customId.split(':')[2];
        const order = await models_1.StoreOrder.findOne({ orderId });
        if (!order) {
            await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
            return;
        }
        if (order.buyerId !== interaction.user.id) {
            await interaction.reply({ content: '⛔ هذا الطلب ليس لك', ephemeral: true });
            return;
        }
        if (order.status !== 'pending') {
            await interaction.reply({ content: 'ℹ️ هذا الطلب تم التعامل معه مسبقاً', ephemeral: true });
            return;
        }
        const store = await (0, store_1.getStore)(false);
        const prefix = order.probotPrefix || store?.probotPrefix || '!';
        const payeeId = order.payeeId || store?.payeeId;
        const tax = order.taxPercent ?? 5;
        // إرسال إيصال الطلب للبائع/القناة — بدون ما يرى المشتري التفاصيل الخاصة بك
        const card = buildOrderCard(order, prefix, payeeId);
        const cardRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`store:confirmsale:${order.orderId}`)
            .setLabel('تم التسليم والاستلام')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅'), new discord_js_1.ButtonBuilder()
            .setCustomId(`store:cancelsale:${order.orderId}`)
            .setLabel('إلغاء الطلب')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('❌'));
        let deliveredToSeller = false;
        try {
            if (store?.logChannelId) {
                const channel = interaction.guild?.channels.cache.get(store.logChannelId) ??
                    (await interaction.client.channels.fetch(store.logChannelId).catch(() => null));
                if (channel?.isTextBased?.()) {
                    await channel.send({ embeds: [card], components: [cardRow] });
                    deliveredToSeller = true;
                }
            }
            if (!deliveredToSeller && payeeId) {
                const payee = await interaction.client.users.fetch(payeeId).catch(() => null);
                if (payee) {
                    await payee.send({ embeds: [card], components: [cardRow] }).catch(() => { });
                    deliveredToSeller = true;
                }
            }
        }
        catch {
            deliveredToSeller = false;
        }
        const awaitingEmbed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('✅ تم تسجيل طلبك — بانتظار البائع 🤝')
            .setDescription([
            `📦 **البروجيكت:** ${order.projectName}`,
            `🧾 **الطلب:** #${order.orderId}`,
            '',
            `💳 أمر الدفع (إن لم تكن نفذته بعد):`,
            `\`\`\`${prefix}pay ${payeeId ? `<@${payeeId}> ` : ''}${order.amount}\`\`\``,
            '',
            `> 💰 المبلغ **${(0, store_1.formatCredits)(order.amount)}** كريديت — يصل لصافي **${(0, store_1.formatCredits)(order.price)}** بعد خصم ProBot ${tax}%`,
            deliveredToSeller
                ? '> 📲 البائع وصله إشعار — بمجرد تأكيده سيصلك البروجيكت وإيصال الدفع.'
                : '> 📲 تعذر إيصال الإشعار الآن — إذا تأخر التسليم تواصل مع البائع مباشرة.',
        ].join('\n'))
            .setFooter({ text: 'Omni Store • الاحتفاظ بالطلب حتى تأكيد البائع' })
            .setTimestamp();
        await interaction.update({ embeds: [awaitingEmbed], components: [] });
    },
};
exports.default = handler;
//# sourceMappingURL=storePaid.js.map