// ============================================
// Omni Bot - زر شراء بروجيكت داخل التذكرة
// متاح لصاحب التذكرة فقط — لكن الرد يكون ظاهر للكل في قناة التذكرة
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings, Ticket } from '../../models';
import { getStore, buildStoreEmbed, buildStoreSelect } from '../../utils/store';

const handler: ButtonHandler = {
  id: 'ticket_buy',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: '❌ يعمل في قناة التذكرة فقط', ephemeral: true });
      return;
    }

    const settings = await getGuildSettings(interaction.guild.id).catch(() => null);
    if (!(settings as any)?.tickets?.buyButtonEnabled) {
      await interaction.reply({
        content: '❌ زر الشراء غير مفعّل حالياً — فعّله الأدمن من `/settings` ← التذاكر.',
        ephemeral: true,
      });
      return;
    }

    const ticket = await Ticket.findOne({
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      status: { $in: ['open', 'claimed', 'waiting'] },
    })
      .lean()
      .catch(() => null);

    if (!ticket) {
      await interaction.reply({ content: '❌ هذه القناة ليست قناة تذكرة نشطة.', ephemeral: true });
      return;
    }

    // 🔒 الزر لصاحب التذكرة فقط — الباقي يتفرج بس
    if (String(ticket.userId) !== interaction.user.id) {
      await interaction.reply({
        content: '⛔ هذا الزر لصاحب التذكرة فقط — لكن تقدر تتفرج على التفاصيل اللي طلعتها.',
        ephemeral: true,
      });
      return;
    }

    // 🛍️ ردّ عام يظهر للكل في التذكرة (مش ephemeral)
    await interaction.deferReply({ ephemeral: false });

    const store = await getStore();
    if (!store) {
      await interaction.editReply({
        content: '❌ تعذر فتح المتجر حالياً — حاول لاحقاً.',
      });
      return;
    }

    const components = buildStoreSelect(store) ?? [];
    const embed = buildStoreEmbed(store);

    if (!components.length) {
      await interaction.editReply({
        content: '🛍️ **المتجر فارغ حالياً** — ما في بروجيكتات متاحة للبيع الآن.',
        embeds: [embed],
      });
      return;
    }

    embed.setFooter({ text: 'Omni Store • اختر البروجيكت من القائمة — الرد ظاهر للكل' });
    await interaction.editReply({ embeds: [embed], components });
  },
};

export default handler;
