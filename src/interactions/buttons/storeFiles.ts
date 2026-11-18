// ============================================
// Omni Bot - 📁 متجر Omni (أزرار تسليم الملفات للمشتري)
// تأكيد = يرسل الملفات المرفقة بالعنصر — إلغاء = ما تُرسل
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { canManageStore, getStore, findProject, storeTypeMeta } from '../../utils/store';
import { deliveryFilePaths } from '../../utils/deliveryFiles';
import { StoreOrder } from '../../models';

const handler: ButtonHandler = {
  id: 'store:files',
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split(':');
    const action = parts[2];
    const orderId = parts[3];
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
    if (order.status !== 'paid') {
      await interaction.reply({
        content: 'ℹ️ لا يمكن إرسال الملفات قبل تأكيد الدفع — المشتري لسه ما دفع.',
        ephemeral: true,
      });
      return;
    }

    const store = await getStore(false).catch(() => null);
    const project = store && findProject(store, order.projectId);
    const files = (Array.isArray(project?.deliveryFiles) ? project!.deliveryFiles! : []).filter(
      (f: any) => f?.path
    );

    // ---------- إلغاء — ما تترسل الملفات ----------
    if (action === 'cancel') {
      await StoreOrder.updateOne({ orderId }, { $set: { filesStatus: 'cancelled' } }).catch(() => {});
      const previous = interaction.message.content ? `${interaction.message.content}\n\n` : '';
      await interaction
        .update({
          content: `${previous}⛔ **ألغى ${interaction.user} إرسال الملفات الآن** — تواصل مع <@${order.buyerId}> مباشرة لتسليمها.`,
          embeds: [],
          components: [],
        })
        .catch(() => {});
      return;
    }

    // ---------- تأكيد — ترسل الملفات ----------
    if (!files.length) {
      await StoreOrder.updateOne({ orderId }, { $set: { filesStatus: 'cancelled' } }).catch(() => {});
      await interaction
        .update({
          content: '⚠️ هذا العنصر ما عاد فيه ملفات مرفقة — تم الإلغاء تلقائياً.',
          embeds: [],
          components: [],
        })
        .catch(() => {});
      return;
    }
    if (order.filesStatus === 'sent') {
      await interaction.reply({ content: 'ℹ️ الملفات أُرسلت مسبقاً لهذا الطلب.', ephemeral: true });
      return;
    }

    // ✅ ملفات موجودة على القرص؟
    const paths = await deliveryFilePaths(files);
    if (!paths.length) {
      await StoreOrder.updateOne({ orderId }, { $set: { filesStatus: 'cancelled' } }).catch(() => {});
      await interaction
        .update({
          content:
            '❌ الملفات المرفقة غير موجودة على القرص (ربما حُذفت أو انتقلت الاستضافة) — ارفعها من جديد عبر `/project edit` مع المرفقات.',
          embeds: [],
          components: [],
        })
        .catch(() => {});
      return;
    }

    // 🧭 مكان الإرسال: التكت نفسه — ولو تعذر، الخاص بالمشتري
    let target: any = null;
    if (order.channelId) {
      target =
        interaction.guild?.channels.cache.get(order.channelId) ??
        (await interaction.client.channels.fetch(order.channelId).catch(() => null));
      if (!target?.isTextBased?.()) target = null;
    }
    if (!target) {
      const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
      target = buyer?.dmChannel ?? (await buyer?.createDM().catch(() => null));
    }
    if (!target) {
      await interaction.reply({
        content: '❌ تعذر تحديد مكان التسليم — لا التكت موجود ولا الخاص يشتغل.',
        ephemeral: true,
      });
      return;
    }

    const attachments = paths.map((p) => ({ attachment: p.absolute, name: p.name }));
    try {
      await target.send({
        content:
          `📦 **تسليم ملفات «${project?.name ?? order.projectName}»** — تفضل <@${order.buyerId}>\n` +
          (project?.deliveryNote?.trim() ? `> 📬 ${project.deliveryNote.trim()}\n` : '') +
          `> 🔑 طلب #${order.orderId} • ${storeTypeMeta(order.itemType).emoji} بواسطة <@${interaction.user.id}>`,
        files: attachments,
      });
    } catch (error: any) {
      await interaction.reply({
        content: `❌ تعذر إرسال الملفات: ${error?.message || error}\n> تأكد أن التكت يسمح بإرفاق الملفات (View Channel + Send Messages + Attach Files)`,
        ephemeral: true,
      });
      return;
    }

    await StoreOrder.updateOne({ orderId }, { $set: { filesStatus: 'sent' } }).catch(() => {});
    await interaction
      .update({
        content: `✅ **تم إرسال ${paths.length} ملف** إلى ${
          order.channelId && target?.id === order.channelId ? `<#${order.channelId}>` : 'الخاص بالمشتري'
        } — الطلب #${order.orderId} مُكتمل التسليم 🎉`,
        embeds: [],
        components: [],
      })
      .catch(() => {});

    // 👋 إشعار إضافي للمشتري في خاصه إذا استلم في التكت
    if (order.channelId && target?.id === order.channelId) {
      const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
      if (buyer) {
        await buyer
          .send({ content: `🎉 تسلمت ملفات «${order.projectName}» — شكراً لثقتك! لو فيها أي مشكلة تواصل مع البائع.` })
          .catch(() => {});
      }
    }
  },
};

export default handler;
