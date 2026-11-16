// ============================================
// Omni Bot - متجر البروجيكتات (القائمة المنسدلة)
// ============================================

import {
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { getStore, findProject, computeTransferAmount, priceLine, formatCredits } from '../../utils/store';

const handler: SelectMenuHandler = {
  id: 'store:select',
  async execute(interaction) {
    const select = interaction as StringSelectMenuInteraction;
    if (!select.guild) return;

    await select.deferReply({ ephemeral: true });

    const projectId = select.values?.[0];
    const store = await getStore();
    const project = store && projectId ? findProject(store, projectId) : undefined;

    if (!store || !project || !project.enabled) {
      await select.editReply({
        content: '❌ هذا البروجيكت غير متاح حالياً — ربما أُزيل من المتجر أو أُوقف مؤقتاً.',
      });
      return;
    }

    const tax = Number(store.taxPercent ?? 5);
    const amount = computeTransferAmount(project.price, tax);
    const payee = store.payeeId;

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🛒 تأكيد طلب الشراء')
      .setDescription(
        [
          `📦 **البروجيكت:** ${project.name}`,
          project.description?.trim() ? `📝 ${project.description.trim()}` : null,
          '',
          `💰 **السعر الصافي:** ${priceLine(project.price)} كريديت`,
          `🧾 **خصم ProBot:** ${tax}% على التحويلات`,
          `💳 **المطلوب تحويله:** ${priceLine(amount)} كريديت`,
          payee ? `👤 **المستلم:** <@${payee}>` : '👤 **المستلم:** غير مهيأ بعد — أبلغ البائع',
          '',
          '> بعد التأكيد بنعرض لك **أمر الدفع الجاهز** تنسخه وتلصقه في الشات.',
        ]
          .filter(Boolean)
          .join('\n')
      )
      .setFooter({ text: 'Omni Store • التأكيد قبل الدفع' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`store:confirm:${project.id}`)
        .setLabel('تأكيد الشراء')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('store:back')
        .setLabel('رجوع')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

    await select.editReply({ embeds: [embed], components: [row] });
  },
};

export default handler;
