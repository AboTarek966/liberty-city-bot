// ============================================
// Omni Bot - 🛍️ متجر Omni (زر إلغاء الطلب)
// المشتري (طلبه) أو البائع/مدير المتجر يقدر يلغي
// ============================================

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { canManageStore, formatCredits } from '../../utils/store';
import { StoreOrder } from '../../models';

const handler: ButtonHandler = {
  id: 'store:cancelsale',
  async execute(interaction: ButtonInteraction) {
    const orderId = interaction.customId.split(':')[2];
    const order = await StoreOrder.findOne({ orderId });

    if (!order) {
      await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
      return;
    }

    const isBuyer = order.buyerId === interaction.user.id;
    const isPayee = !!order.payeeId && order.payeeId === interaction.user.id;
    const isStaff = await canManageStore(interaction.client, interaction.user.id);
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

    const cancelledEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('❌ تم إلغاء الطلب')
      .setDescription(
        [
          `📦 **العنصر:** ${order.projectName}`,
          `🧾 **الطلب:** #${order.orderId} — أُلغي بواسطة <@${interaction.user.id}>`,
          `💰 **المبلغ:** ${formatCredits(order.amount)} كريديت (لم يتم خصم أي شيء بعد التأكيد)`,
        ].join('\n')
      )
      .setTimestamp()
      .setFooter({ text: 'Omni Store • الطلب ملغى' });

    await interaction.update({ embeds: [cancelledEmbed], components: [] }).catch(() => {});

    // إشعار المشتري إنه ألغى/أُلغي طلبه
    try {
      const isOwnCancel = isBuyer;
      const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
      if (buyer) {
        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle(isOwnCancel ? '✅ تم إلغاء طلبك' : '⚠️ تم إلغاء طلب شراء')
          .setDescription(
            isOwnCancel
              ? `طلبك لـ«${order.projectName}» (#${order.orderId}) أُلغي بنجاح. لو كنت دفعت بالفعل راجع البائع.`
              : `تم إلغاء طلبك لـ«${order.projectName}» (#${order.orderId}) بواسطة البائع/الإدارة. إن كنت دفعت، راجعهم لمعالجة المبلغ.`
          )
          .setTimestamp();
        await buyer.send({ embeds: [embed] }).catch(() => {});
      }
    } catch {
      /* تجاهل */
    }
  },
};

export default handler;
