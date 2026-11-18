// ============================================
// Omni Bot - 🛍️ متجر Omni (زر / دفعت وطلب التسليم)
// ============================================

import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getStore, formatCredits, buildTransferCommand, storeTypeMeta } from '../../utils/store';
import { StoreOrder } from '../../models';

/** بناء بطاقة الطلب المرسلة للبائع/قناة السجل */
function buildOrderCard(order: any, _prefix: string, payeeId: string | undefined): EmbedBuilder {
  const meta = storeTypeMeta(order.itemType);
  const emoji = order.itemEmoji || meta.emoji;
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🛒 طلب شراء جديد — #${order.orderId}`)
    .setDescription(
      [
        `${emoji} **العنصر:** ${order.projectName}`,
        `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
        `👤 **المشتري:** <@${order.buyerId}> (\`${order.buyerId}\`)`,
        `💰 **السعر الصافي:** ${formatCredits(order.price)}`,
        `🧾 **المطلوب تحويله:** ${formatCredits(order.amount)} (بعد خصم ProBot ${order.taxPercent ?? 5}%)`,
        payeeId ? `💳 **أمر الدفع:** \`${buildTransferCommand(payeeId, order.amount)}\`` : null,
        '',
        '> 🔔 العميل يؤكد أنه دفع — راجع التحويل، وبعد ما يصلك الصافي اضغط **تم التسليم والاستلام**.',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .setFooter({ text: 'Omni Store • إيصال طلب — الحفظ في سجل الطلبات' })
    .setTimestamp();
}

const handler: ButtonHandler = {
  id: 'store:paid',
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
    if (order.status !== 'pending') {
      await interaction.reply({ content: 'ℹ️ هذا الطلب تم التعامل معه مسبقاً', ephemeral: true });
      return;
    }

    const store = await getStore(false);
    const prefix = order.probotPrefix || store?.probotPrefix || '!';
    const payeeId = order.payeeId || store?.payeeId;
    const tax = order.taxPercent ?? 5;
    const meta = storeTypeMeta(order.itemType);
    const emoji = order.itemEmoji || meta.emoji;

    // إرسال إيصال الطلب للبائع/القناة — بدون ما يرى المشتري التفاصيل الخاصة بك
    const card = buildOrderCard(order, prefix, payeeId);
    const cardRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`store:confirmsale:${order.orderId}`)
        .setLabel('تم التسليم والاستلام')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`store:cancelsale:${order.orderId}`)
        .setLabel('إلغاء الطلب')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    let deliveredToSeller = false;
    try {
      if (store?.logChannelId) {
        const channel: any =
          interaction.guild?.channels.cache.get(store.logChannelId) ??
          (await interaction.client.channels.fetch(store.logChannelId).catch(() => null));
        if (channel?.isTextBased?.()) {
          await channel.send({ embeds: [card], components: [cardRow] });
          deliveredToSeller = true;
        }
      }
      if (!deliveredToSeller && payeeId) {
        const payee = await interaction.client.users.fetch(payeeId).catch(() => null);
        if (payee) {
          await payee.send({ embeds: [card], components: [cardRow] }).catch(() => {});
          deliveredToSeller = true;
        }
      }
    } catch {
      deliveredToSeller = false;
    }

    const awaitingEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('✅ تم تسجيل طلبك — بانتظار البائع 🤝')
      .setDescription(
        [
          `${emoji} **العنصر:** ${order.projectName} (${meta.label})`,
          `🧾 **الطلب:** #${order.orderId}`,
          '',
          `💳 أمر الدفع (إن لم تكن نفذته بعد):`,
          `\`\`\`${payeeId ? buildTransferCommand(payeeId, order.amount) : 'غير متوفر'}\`\`\``,
          '',
          `> 💰 المبلغ **${formatCredits(order.amount)}** كريديت — يصل لصافي **${formatCredits(order.price)}** بعد خصم ProBot ${tax}%`,
          deliveredToSeller
            ? '> 📲 البائع وصله إشعار — بمجرد تأكيده سيصلك العنصر وإيصال الدفع.'
            : '> 📲 تعذر إيصال الإشعار الآن — إذا تأخر التسليم تواصل مع البائع مباشرة.',
        ].join('\n')
      )
      .setFooter({ text: 'Omni Store • الاحتفاظ بالطلب حتى تأكيد البائع' })
      .setTimestamp();

    await interaction.update({ embeds: [awaitingEmbed], components: [] });
  },
};

export default handler;
