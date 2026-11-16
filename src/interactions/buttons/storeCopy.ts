// ============================================
// Omni Bot - متجر البروجيكتات (زر نسخ أمر الدفع)
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getStore, formatCredits } from '../../utils/store';
import { StoreOrder } from '../../models';

const handler: ButtonHandler = {
  id: 'store:copy',
  async execute(interaction: ButtonInteraction) {
    const orderId = interaction.customId.split(':')[2];
    const order = await StoreOrder.findOne({ orderId });

    if (!order) {
      await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
      return;
    }
    if (order.buyerId !== interaction.user.id) {
      await interaction.reply({ content: '⛔ هذا الطلب ليس لك', ephemeral: true });
      return;
    }

    const store = await getStore(false);
    const prefix = order.probotPrefix || store?.probotPrefix || '!';
    const payeeId = order.payeeId || store?.payeeId;

    if (!payeeId) {
      await interaction.reply({ content: '❌ المتجر غير مهيأ — أبلغ البائع', ephemeral: true });
      return;
    }

    const transferCommand = `${prefix}pay <@${payeeId}> ${order.amount}`;

    await interaction.reply({
      content:
        '📋 **انسخ أمر الدفع حرفيًا ثم الصقه في الشات:**\n' +
        '```\n' + transferCommand + '\n```\n' +
        `> 💰 المبلغ: **${formatCredits(order.amount)}** كريديت — يصل لصافي **${formatCredits(order.price)}** بعد خصم ProBot\n` +
        '> 💡 الطريقة الأسرع: اضغط مطولًا (جوال) أو بالمؤشر (ديسكتوب) على الأمر داخل المربع ثم انسخ.',
      ephemeral: true,
    });
  },
};

export default handler;
