// ============================================
// Omni Bot - متجر البروجيكتات (زر تأكيد الشراء)
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
} from '../../utils/store';
import { StoreOrder } from '../../models';

const handler: ButtonHandler = {
  id: 'store:confirm',
  async execute(interaction: ButtonInteraction) {
    const projectId = interaction.customId.split(':')[2];
    if (!projectId) return;

    const store = await getStore();
    const project = store && findProject(store, projectId);
    if (!store || !project || !project.enabled) {
      await interaction.reply({
        content: '❌ هذا البروجيكت غير متاح حالياً.',
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
    const amount = computeTransferAmount(project.price, tax);

    // ♻︎ منع تكرار طلبات مفتوحة لنفس المشروع ونفس المشتري خلال 15 دقيقة
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
        price: project.price,
        amount,
        taxPercent: tax,
        payeeId: store.payeeId,
        probotPrefix: store.probotPrefix || '!',
        buyerId: interaction.user.id,
        guildId: interaction.guildId ?? undefined,
      }));

    const transferCommand = buildTransferCommand(store.payeeId, amount);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('💳 أمر الدفع جاهز — انسخه ونفذه في الشات')
      .setDescription(
        [
          `📦 **البروجيكت:** ${project.name}`,
          `🧾 **الطلب:** #${order.orderId}`,
          '',
          `💰 **السعر الصافي (يوصلك البائع):** ${priceLine(project.price)} كريديت`,
          `🧾 **خصم ProBot:** ${tax}% من كل تحويل`,
          `💳 **المطلوب تحويله:** ${formatCredits(amount)} كريديت`,
          '',
          '**📋 أمر التحويل (انسخه حرفيًا):**',
          `\`\`\`${transferCommand}\`\`\``,
          '',
          `> ⬆️ انسخ الأمر وأرسله في أي روم يقرأ البوت — الصيغة: \`credit ${store.payeeId} ${amount}#\``,
          '> 💡 المبلغ مظبوط يصلك **صافي** على سعر البروجيكت بعد خصم ProBot.',
        ].join('\n')
      )
      .setFooter({ text: 'Omni Store • انتظر تأكيد البائع من بلوك الإيصال' })
      .setTimestamp();

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
        .setLabel('رجوع')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
};

export default handler;
