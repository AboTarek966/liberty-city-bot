"use strict";
// ============================================
// Omni Bot - متجر البروجيكتات (زر نسخ أمر الدفع)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("../../utils/store");
const models_1 = require("../../models");
const handler = {
    id: 'store:copy',
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
        const store = await (0, store_1.getStore)(false);
        const payeeId = order.payeeId || store?.payeeId;
        if (!payeeId) {
            await interaction.reply({ content: '❌ المتجر غير مهيأ — أبلغ البائع', ephemeral: true });
            return;
        }
        const transferCommand = (0, store_1.buildTransferCommand)(payeeId, order.amount);
        await interaction.reply({
            content: '📋 **انسخ أمر الدفع حرفيًا ثم الصقه في الشات:**\n' +
                '```\n' + transferCommand + '\n```\n' +
                `> 💰 المبلغ: **${(0, store_1.formatCredits)(order.amount)}** كريديت — يصل لصافي **${(0, store_1.formatCredits)(order.price)}** بعد خصم ProBot\n` +
                '> 💡 الطريقة الأسرع: اضغط مطولًا (جوال) أو بالمؤشر (ديسكتوب) على الأمر داخل المربع ثم انسخ.',
            ephemeral: true,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=storeCopy.js.map