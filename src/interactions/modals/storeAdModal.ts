// ============================================
// Omni Bot - 📢 متجر Omni (مودال الإعلان — كتابة البائع/الرفض)
// store:ad:compose:<orderId> = المشتري يكتب إعلان+دعوة → يُرسل للبائع للاعتماد
// store:ad:reject:<orderId>  = البائع يكتب سبب الرفض (اختياري) → المشتري يُبلَّغ
// ============================================

import {
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { canManageStore, getStore, findProject, storeTypeMeta } from '../../utils/store';
import { StoreOrder } from '../../models';

/** استخراج معرّف الدعوة من رابط ديسكورد */
function extractInviteCode(raw: string): string | null {
  const m = String(raw ?? '')
    .trim()
    .match(/(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?/i);
  return m ? m[1] : null;
}

const handler: ModalHandler = {
  id: 'store:ad',
  async execute(interaction: ModalSubmitInteraction) {
    const parts = interaction.customId.split(':');
    const sub = parts[2];
    const orderId = parts[3];
    const order = await StoreOrder.findOne({ orderId });

    if (!order) {
      await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
      return;
    }

    // ---------- 📝 المشتري كتب إعلان → أرسله للبائع للاعتماد ----------
    if (sub === 'compose') {
      if (order.buyerId !== interaction.user.id) {
        await interaction.reply({ content: '⛔ هذا المودال لصاحب الطلب فقط.', ephemeral: true });
        return;
      }
      if (order.status !== 'paid') {
        await interaction.reply({ content: 'ℹ️ لم يتأكد دفعك بعد — لا يمكن إرسال إعلان قبل الدفع.', ephemeral: true });
        return;
      }

      const text = String(interaction.fields.getTextInputValue('ad_text') || '').trim().slice(0, 4000);
      const rawLink = String(interaction.fields.getTextInputValue('ad_link') || '').trim().slice(0, 200);
      const code = extractInviteCode(rawLink);
      if (!code) {
        await interaction.reply({
          content: '❌ رابط الدعوة غير صالح — لازم يكون رابط دعوة ديسكورد مثل `https://discord.gg/xxxxxx` أو منشن على روحك.',
          ephemeral: true,
        });
        return;
      }
      const link = `https://discord.gg/${code}`;

      // تحقق من الدعوة فعلياً — يعرض اسم السيرفر وعدد الأعضاء
      let guildName = '';
      let memberCount: number | undefined;
      try {
        const invite: any = await interaction.client.fetchInvite(code);
        guildName = invite?.guild?.name ? String(invite.guild.name).slice(0, 90) : '';
        memberCount =
          typeof invite?.approximate_member_count === 'number'
            ? invite.approximate_member_count
            : typeof invite?.memberCount === 'number'
              ? invite.memberCount
              : undefined;
      } catch {
        await interaction.reply({
          content: '❌ تعذر قراءة هذه الدعوة (قد تكون منتهيّة أو خاصة) — أنشئ دعوة جديدة بدون انتهاء وحاول مجدداً.',
          ephemeral: true,
        });
        return;
      }

      order.adText = text;
      order.adLink = link;
      order.adStatus = 'submitted';
      order.adGuildName = guildName || undefined;
      order.adReason = undefined;
      await order.save();

      // 🎴 بطاقة الإعلان للبائع مع زرّي الاعتماد/الرفض
      const store = await getStore(false).catch(() => null);
      const project = store && findProject(store, order.projectId);
      const meta = storeTypeMeta(order.itemType ?? 'ad');

      const card = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`📢 إعلان جديد — طلب #${order.orderId}`)
        .setDescription(text)
        .addFields(
          { name: '🏷️ العنصر', value: `${meta.emoji} ${project?.name || order.projectName}`, inline: true },
          { name: '👤 المشتري', value: `<@${order.buyerId}> (\`${order.buyerId}\`)`, inline: true },
          {
            name: '🔗 دعوة سيرفر المشتري',
            value:
              `[${link}](${link})` +
              (guildName ? `\n🏰 السيرفر: **${guildName}**` : '') +
              (typeof memberCount === 'number' ? `\n👥 الأعضاء: **${memberCount.toLocaleString('en-US')}**` : ''),
            inline: false,
          }
        )
        .setFooter({ text: 'Omni Store • إعلان — يحتاج اعتماد البائع قبل نشره' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`store:ad:approve:${order.orderId}`)
          .setLabel('اعتمد الإعلان')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`store:ad:reject:${order.orderId}`)
          .setLabel('رفض')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

      let delivered = false;
      if (order.payeeId) {
        const payee = await interaction.client.users.fetch(order.payeeId).catch(() => null);
        if (payee) {
          await payee.send({ embeds: [card], components: [row] }).catch(() => {});
          delivered = true;
        }
      }
      if (!delivered && store?.logChannelId) {
        const channel: any =
          (interaction.guild as any)?.channels?.cache?.get(store.logChannelId) ??
          (await interaction.client.channels.fetch(store.logChannelId).catch(() => null));
        if (channel?.isTextBased?.()) {
          await channel.send({ embeds: [card], components: [row] }).catch(() => {});
          delivered = true;
        }
      }

      // رد على المودال حتى ما يقف عند المشتري (ديسكورد يطلب استجابة خلال ثوانٍ)
      await interaction
        .reply({
          content: `✅ **استلمنا إعلانك** — ${delivered ? 'البائع راح يراجعه ويعتمده أو يرفضه، وتوصلك النتيجة في الخاص' : 'تعذر تسليمها للبائع الآن — تواصل مع البائع مباشرة'}.`,
          ephemeral: true,
        })
        .catch(() => {});
      // حدّث رسالة التكت — خلاص ما فيه داعي للزر مرة أخرى
      const ticketPrompt = interaction.message as any;
      if (ticketPrompt?.edit) {
        await ticketPrompt
          .edit({
            content: `✅ **استلمنا إعلانك** — تم إرسالها للبائع للمراجعة. ${delivered ? '' : '(تعذر تسليمها — تواصل مع البائع)'}`,
            embeds: [],
            components: [],
          })
          .catch(() => {});
      }
      return;
    }

    // ---------- ❌ البائع رفض الإعلان — سبب اختياري ----------
    if (sub === 'reject') {
      const isPayee = !!order.payeeId && order.payeeId === interaction.user.id;
      const isStaff = await canManageStore(interaction.client, interaction.user.id);
      if (!isPayee && !isStaff) {
        await interaction.reply({ content: '⛔ هذا المودال لبائع الطلب أو من يدير المتجر فقط.', ephemeral: true });
        return;
      }
      const reason = String(interaction.fields.getTextInputValue('reason') || '').trim().slice(0, 200);
      order.adStatus = 'rejected';
      order.adReason = reason || undefined;
      await order.save();

      // ⚡ رد على المودال الأول (متطلبات ديسكورد)
      await interaction
        .reply({
          content: `❌ **تم رفض الإعلان** (طلب #${order.orderId})${reason ? `\n> السبب: ${reason}` : ''}`,
          ephemeral: true,
        })
        .catch(() => {});
      const rejectCard = interaction.message as any;
      if (rejectCard?.edit) {
        await rejectCard
          .edit({
            content: `❌ **رفض ${interaction.user} الإعلان** (طلب #${order.orderId})${reason ? `\n> السبب: ${reason}` : ''}`,
            embeds: [],
            components: [],
          })
          .catch(() => {});
      }

      try {
        const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
        if (buyer) {
          await buyer
            .send({
              content:
                `❌ **تم رفض إعلانك** — طلب #${order.orderId}` +
                (reason ? `\n> السبب: ${reason}` : '') +
                `\n> تقدر تعيد كتابته مع تعدل السبب المذكور — اضغط زر الإعلان في التكت مرة أخرى أو تواصل مع البائع.`,
            })
            .catch(() => {});
        }
      } catch {
        /* تجاهل */
      }
      return;
    }
  },
};

export default handler;
