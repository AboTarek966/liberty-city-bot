// ============================================
// Omni Bot - 🛍️ متجر Omni (القائمة المنسدلة)
// ============================================

import {
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import {
  getStore,
  findProject,
  computeTransferAmount,
  priceLine,
  normalizeDiscountPercent,
  getEffectivePrice,
  storeTypeMeta,
  storeItemEmoji,
  isItemInStock,
} from '../../utils/store';

const handler: SelectMenuHandler = {
  id: 'store:select',
  async execute(interaction) {
    const select = interaction as StringSelectMenuInteraction;
    if (!select.guild) return;

    // 🧪 لو القائمة جاية من معاينة خاصة (ephemeral) نخلي تفاصيل الطلب خاصة برضه
    const fromEphemeral = Boolean(select.message?.flags?.has(MessageFlags.Ephemeral));
    await select.deferReply({ ephemeral: fromEphemeral });

    const projectId = select.values?.[0];
    const store = await getStore();
    const project = store && projectId ? findProject(store, projectId) : undefined;

    if (!store || !project || !project.enabled) {
      await select.editReply({
        content: '❌ هذا العنصر غير متاح حالياً — ربما أُزيل من المتجر أو أُوقف مؤقتاً.',
      });
      return;
    }

    if (!isItemInStock(project)) {
      await select.editReply({
        content: `⛔ **${project.name}** نفدت كميته حالياً — جرّب عنصراً آخر أو تواصل مع البائع.`,
      });
      return;
    }

    const meta = storeTypeMeta(project.type);
    const emoji = storeItemEmoji(project);
    const tax = Number(store.taxPercent ?? 5);
    const discount = normalizeDiscountPercent(project.discountPercent);
    const effectivePrice = getEffectivePrice(project);
    const amount = computeTransferAmount(effectivePrice, tax);
    const payee = store.payeeId;

    const embed = new EmbedBuilder()
      .setColor(meta.color)
      .setTitle('🛒 تأكيد طلب الشراء')
      .setDescription(
        [
          `${emoji} **العنصر:** ${project.name}`,
          `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
          project.description?.trim() ? `📝 ${project.description.trim()}` : null,
          project.stock !== undefined ? `📦 **المتاح:** ${project.stock}` : null,
          '',
          discount
            ? `💰 **السعر الأساسي:** ~~${priceLine(project.price)}~~ كريديت`
            : `💰 **السعر الصافي:** ${priceLine(effectivePrice)} كريديت`,
          discount ? `🏷️ **خصم ${discount}%** — السعر بعد الخصم: ${priceLine(effectivePrice)} كريديت` : null,
          `🧾 **خصم ProBot:** ${tax}% على التحويلات`,
          `💳 **المطلوب تحويله:** ${priceLine(amount)} كريديت`,
          payee ? `👤 **المستلم:** <@${payee}>` : '👤 **المستلم:** غير مهيأ بعد — أبلغ البائع',
          '',
          '> بعد التأكيد بنعرض للكل ملخص الطلب — وأمر الدفع يفضل ظاهر بس للمشتري عبر الزر 📋.',
        ]
          .filter(Boolean)
          .join('\n')
      )
      .setFooter({ text: 'Omni Store • التأكيد قبل الدفع' })
      .setTimestamp();

    if (project.imageUrl) embed.setImage(project.imageUrl);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`store:confirm:${project.id}:${select.user.id}`)
        .setLabel('تأكيد الشراء')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('store:back')
        .setLabel('رجوع للمتجر')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

    await select.editReply({ embeds: [embed], components: [row] });
  },
};

export default handler;
