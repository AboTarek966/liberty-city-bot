// ============================================
// Omni Bot - متجر البروجيكتات (زر تم التسليم والاستلام)
// البائع/مدير المتجر فقط — يغلق الطلب ويزيد المبيعات ويرسل إيصال للمشتري
// ============================================

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { canManageStore, getStore, findProject, formatCredits } from '../../utils/store';
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

    // زيادة عداد المبيعات على البروجيكت
    const store = await getStore(false);
    const project = store && findProject(store, order.projectId);
    if (project) {
      project.sales = (project.sales || 0) + 1;
      await store.save().catch(() => {});
    }

    // 🏷️ منح رول المشتري (إن وُجد مربوط بالبروجيكت)
    let roleLine: string | null = null;
    const deliveryRoleId = (project as any)?.deliveryRoleId as string | undefined;
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
          `📦 **البروجيكت:** ${order.projectName}`,
          `🧾 **الطلب:** #${order.orderId}`,
          `💰 **الصافي:** ${formatCredits(order.price)} كريديت`,
          `👤 **أكّد التسليم:** <@${interaction.user.id}>`,
          '',
          project ? `📊 إجمالي مبيعات هذا البروجيكت: **${project.sales}**` : null,
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
              `📦 **البروجيكت:** ${order.projectName}`,
              `🧾 **طلب:** #${order.orderId}`,
              `💰 **المبلغ:** ${formatCredits(order.amount)} كريديت (صافي ${formatCredits(order.price)})`,
              '',
              'لو عندك أي استفسار عن البروجيكت بعد التسليم، تواصل مع البائع مباشرة.',
            ].join('\n')
          )
          .setTimestamp()
          .setFooter({ text: 'Omni Store • شكراً لثقتك' });
        await buyer.send({ embeds: [receipt] }).catch(() => {});
      }
    } catch {
      /* تجاهل */
    }
  },
};

export default handler;
