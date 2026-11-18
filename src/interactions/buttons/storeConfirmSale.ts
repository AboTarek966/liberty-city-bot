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

    order.status = 'paid';
    order.paidBy = interaction.user.id;
    order.paidAt = new Date();
    await order.save();

    // زيادة عداد المبيعات + خصم الكمية من المخزون
    const store = await getStore(false);
    const project = store && findProject(store, order.projectId);
    let stockLine: string | null = null;
    if (project) {
      project.sales = (project.sales || 0) + 1;
      if (project.stock !== undefined && project.stock !== null && project.stock > 0) {
        project.stock = Math.max(0, project.stock - 1);
        stockLine =
          project.stock === 0
            ? '📦 الكمية: **نفدت بالكامل** بعد هذا الطلب'
            : `📦 الكمية المتبقية: **${project.stock}**`;
      }
      await store.save().catch(() => {});
    }

    const meta = storeTypeMeta(order.itemType ?? project?.type);
    const emoji = order.itemEmoji || (project ? storeItemEmoji(project) : meta.emoji);

    // 🏷️ منح رول المشتري (إن وُجد مربوط بالعنصر)
    let roleLine: string | null = null;
    const deliveryRoleId = project?.deliveryRoleId;
    if (deliveryRoleId) {
      const guild = interaction.guild;
      if (!guild) {
        roleLine = '⚠️ تعذر منح رول المشتري — الزر أُستخدم خارج السيرفر.';
      } else {
        const member = await guild.members.fetch(order.buyerId).catch(() => null);
        if (!member) {
          roleLine = '⚠️ تعذر جلب عضوية المشتري من السيرفر لمنحه الرول.';
        } else if (member.roles.cache.has(deliveryRoleId)) {
          roleLine = `🏷️ رول المشتري: <@&${deliveryRoleId}> — يملكه بالفعل ✅`;
        } else {
          try {
            await member.roles.add(deliveryRoleId, `Omni Store — تسليم طلب #${order.orderId}`);
            roleLine = `🏷️ رول المشتري: <@&${deliveryRoleId}> ✅ تم منحه`;
          } catch {
            roleLine = `⚠️ رول المشتري: <@&${deliveryRoleId}> — تعذر منحه (رتبة البوت/الصلاحيات أو الرول غير موجود)`;
          }
        }
      }
    }

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
          project ? `📊 إجمالي مبيعات هذا العنصر: **${project.sales}**` : null,
          stockLine,
          roleLine,
        ]
          .filter(Boolean)
          .join('\n')
      )
      .setTimestamp()
      .setFooter({ text: 'Omni Store • طلب مُغلق ومُوثّق' });

    await interaction.update({ embeds: [confirmedEmbed], components: [] }).catch(() => {});

    // إيصال الدفع للمشتري في الخاص
    try {
      const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
      if (buyer) {
        const receipt = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('🎉 وصل دفعك وتم التسليم — شكراً لك!')
          .setDescription(
            [
              `${emoji} **العنصر:** ${order.projectName}`,
              `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
              `🧾 **طلب:** #${order.orderId}`,
              `💰 **المبلغ:** ${formatCredits(order.amount)} كريديت (صافي ${formatCredits(order.price)})`,
              project?.deliveryNote?.trim()
                ? `\n📬 **تعليمات التسليم:**\n> ${project.deliveryNote.trim().slice(0, 500)}`
                : (order.itemDeliveryNote || '').trim()
                  ? `\n📬 **تعليمات التسليم:**\n> ${(order.itemDeliveryNote || '').trim().slice(0, 500)}`
                  : null,
              '',
              'لو عندك أي استفسار عن العنصر بعد التسليم، تواصل مع البائع مباشرة.',
            ]
              .filter(Boolean)
              .join('\n')
          )
          .setTimestamp()
          .setFooter({ text: 'Omni Store • شكراً لثقتك' });

        if (project?.imageUrl) receipt.setThumbnail(project.imageUrl);
        await buyer.send({ embeds: [receipt] }).catch(() => {});
      }
    } catch {
      /* تجاهل */
    }
  },
};

export default handler;
