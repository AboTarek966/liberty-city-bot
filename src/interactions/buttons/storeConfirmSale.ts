// ============================================
// Omni Bot - 🛍️ متجر Omni (زر تم التسليم والاستلام)
// البائع/مدير المتجر فقط — يغلق الطلب ويزيد المبيعات ويرسل إيصال للمشتري
// ============================================

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import {
  canManageStore,
  getStore,
  findProject,
  formatCredits,
  storeTypeMeta,
  storeItemEmoji,
} from '../../utils/store';
import { fulfillStoreOrder } from '../../utils/storeFulfill';
import { StoreOrder } from '../../models';

const handler: ButtonHandler = {
  id: 'store:confirmsale',
  async execute(interaction: ButtonInteraction) {
    const orderId = interaction.customId.split(':')[2];
    const order = await StoreOrder.findOne({ orderId });

    if (!order) {
      await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
      return;
    }

    const isPayee = !!order.payeeId && order.payeeId === interaction.user.id;
    const isStaff = await canManageStore(interaction.client, interaction.user.id);
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

    const result = await fulfillStoreOrder(interaction.client, {
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

    const store = await getStore(false).catch(() => null);
    const project = store && findProject(store, order.projectId);
    const meta = storeTypeMeta(order.itemType ?? project?.type);
    const emoji = order.itemEmoji || (project ? storeItemEmoji(project) : meta.emoji);

    const confirmedEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('✅ تم التسليم والاستلام')
      .setDescription(
        [
          `${emoji} **العنصر:** ${order.projectName}`,
          `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
          `🧾 **الطلب:** #${order.orderId}`,
          `💰 **الصافي:** ${formatCredits(order.price)} كريديت`,
          `👤 **أكّد التسليم:** <@${interaction.user.id}>`,
          '',
          result.totalSales !== undefined ? `📊 إجمالي مبيعات هذا العنصر: **${result.totalSales}**` : null,
          result.stockLine,
          result.roleLine,
        ]
          .filter(Boolean)
          .join('\n')
      )
      .setTimestamp()
      .setFooter({ text: 'Omni Store • طلب مُغلق ومُوثّق' });

    await interaction.update({ embeds: [confirmedEmbed], components: [] }).catch(() => {});
  },
};

export default handler;
