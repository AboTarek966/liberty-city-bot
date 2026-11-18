// ============================================
// Omni Bot - 🛍️ متجر Omni (زر تأكيد الشراء)
// ينشئ الطلب ويعرض أمر الدفع بالكريديت
// ============================================

import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import {
  getStore,
  findProject,
  computeTransferAmount,
  shortId,
  priceLine,
  formatCredits,
  buildTransferCommand,
  getEffectivePrice,
  normalizeDiscountPercent,
  storeTypeMeta,
  storeItemEmoji,
  isItemInStock,
} from '../../utils/store';
import { StoreOrder } from '../../models';

const handler: ButtonHandler = {
  id: 'store:confirm',
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split(':');
    const projectId = parts[2];
    const ownerId = parts[3];
    if (!projectId) return;
    if (ownerId && ownerId !== interaction.user.id) {
      await interaction.reply({
        content: '⛔ هذا الاختيار لصاحب الطلب فقط — اكتب `/store` واختر عنصرك الخاص.',
        ephemeral: true,
      });
      return;
    }

    const store = await getStore();
    const project = store && findProject(store, projectId);
    if (!store || !project || !project.enabled) {
      await interaction.reply({
        content: '❌ هذا العنصر غير متاح حالياً.',
        ephemeral: true,
      });
      return;
    }
    if (!isItemInStock(project)) {
      await interaction.reply({
        content: `⛔ **${project.name}** نفدت كميته حالياً — جرّب عنصراً آخر.`,
        ephemeral: true,
      });
      return;
    }
    if (!store.payeeId) {
      await interaction.reply({
        content: '❌ المتجر غير مهيأ بعد — أبلغ البائع يضبط المستلم عبر `/project config`.',
        ephemeral: true,
      });
      return;
    }

    const tax = Number(store.taxPercent ?? 5);
    const discount = normalizeDiscountPercent(project.discountPercent);
    const basePrice = Math.max(1, Math.floor(Number(project.price) || 0));
    const netPrice = getEffectivePrice(project);
    const amount = computeTransferAmount(netPrice, tax);
    const meta = storeTypeMeta(project.type);
    const emoji = storeItemEmoji(project);

    // ♻︎ منع تكرار طلبات مفتوحة لنفس العنصر ونفس المشتري خلال 15 دقيقة
    const since = new Date(Date.now() - 15 * 60_000);
    const existing = await StoreOrder.findOne({
      buyerId: interaction.user.id,
      projectId: project.id,
      status: 'pending',
      createdAt: { $gte: since },
    });

    const order =
      existing ??
      (await StoreOrder.create({
        orderId: shortId(6),
        projectId: project.id,
        projectName: project.name,
        itemType: project.type,
        itemEmoji: project.emoji,
        itemDeliveryNote: project.deliveryNote,
        price: netPrice,
        amount,
        taxPercent: tax,
        payeeId: store.payeeId,
        probotPrefix: store.probotPrefix || '!',
        buyerId: interaction.user.id,
        guildId: interaction.guildId ?? undefined,
      }));

    const transferCommand = buildTransferCommand(store.payeeId, amount);

    const embed = new EmbedBuilder()
      .setColor(meta.color)
      .setTitle('💳 تفاصيل طلب الشراء — ظاهرة للكل')
      .setDescription(
        [
          `${emoji} **العنصر:** ${project.name}`,
          `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
          `🧾 **الطلب:** #${order.orderId}`,
          '',
          discount
            ? `💰 **السعر الأساسي:** ~~${priceLine(basePrice)}~~ كريديت`
            : `💰 **السعر الصافي (يوصلك البائع):** ${priceLine(netPrice)} كريديت`,
          discount ? `🏷️ **خصم:** ${discount}% — **السعر بعد الخصم:** ${priceLine(netPrice)} كريديت` : null,
          `🧾 **خصم ProBot:** ${tax}% من كل تحويل`,
          `💳 **المطلوب تحويله:** ${formatCredits(amount)} كريديت`,
          project.deliveryNote?.trim() ? `📬 **التسليم:** ${project.deliveryNote.trim().slice(0, 180)}` : null,
          '',
          '**📋 أمر التحويل (للكل يشوفه):**',
          `\`\`\`${transferCommand}\`\`\``,
          '',
          '> ⬆️ المشتري يدوس **دفعت — طلب التسليم** بعد ما يدفع.',
        ]
          .filter(Boolean)
          .join('\n')
      )
      .setFooter({ text: 'Omni Store • انتظر تأكيد البائع من بلوك الإيصال' })
      .setTimestamp();

    if (project.imageUrl) embed.setThumbnail(project.imageUrl);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`store:copy:${order.orderId}`)
        .setLabel('نسخ أمر الدفع')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId(`store:paid:${order.orderId}`)
        .setLabel('دفعت — طلب التسليم')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('store:back')
        .setLabel('رجوع للمتجر')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
};

export default handler;
