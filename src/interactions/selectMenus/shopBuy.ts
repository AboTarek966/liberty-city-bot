// ============================================
// Liberty City Bot - شراء عنصر من المتجر (shop_buy)
// ============================================

import { StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings, UserProfile } from '../../models';
import { Colors } from '../../utils/embeds';
import { formatNumber } from '../../utils/helpers';

const handler: SelectMenuHandler = {
  id: 'shop_buy',
  async execute(interactionRaw) {
    const interaction = interactionRaw as StringSelectMenuInteraction;
    await interaction.deferUpdate(); // ✅ فوراً قبل أي عملية أخرى

    const itemId = interaction.values[0];
    const settings = await getGuildSettings(interaction.guildId!);
    const shop = settings.shop as any;
    const item = (shop?.items || []).find((it: any) => it.id === itemId);

    if (!shop?.enabled) {
      await interaction.editReply({ content: '🔒 تم إغلاق المتجر — لم يتم الشراء', components: [], embeds: [] });
      return;
    }
    if (!item) {
      await interaction.editReply({ content: '❌ هذا العنصر لم يعد موجوداً في المتجر', components: [], embeds: [] });
      return;
    }

    const member = interaction.member as any;
    const role = interaction.guild!.roles.cache.get(item.roleId);
    if (!role) {
      await interaction.editReply({ content: '❌ رول هذا العنصر لم يعد موجوداً — تواصل مع الإدارة', components: [], embeds: [] });
      return;
    }
    if (member.roles.cache.has(item.roleId)) {
      await interaction.editReply({ content: `❌ أنت تملك ${role} بالفعل — لا داعي للشراء`, components: [], embeds: [] });
      return;
    }

    const profile = await UserProfile.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
    }).catch(() => null);

    if (!profile || profile.balance < item.price) {
      await interaction.editReply({
        content: `❌ رصيدك غير كافٍ — تحتاج **${formatNumber(item.price)}** ولديك **${formatNumber(profile?.balance || 0)}**`,
        components: [],
        embeds: [],
      });
      return;
    }

    // فحص أولوية الرول قبل الإضافة
    const me = interaction.guild!.members.me;
    if (!me || role.position >= me.roles.highest.position) {
      await interaction.editReply({
        content: `❌ لا أستطيع إعطاء ${role} — تأكد أن رتبتي أعلى منه`,
        components: [],
        embeds: [],
      });
      return;
    }

    profile.balance -= item.price;
    await profile.save();

    const added = await member.roles.add(role, 'Liberty City - Shop purchase').catch(() => null);
    if (!added) {
      // إرجاع المبلغ إذا فشلت إضافة الرول
      profile.balance += item.price;
      await profile.save();
      await interaction.editReply({
        content: '❌ فشلت إضافة الرول (قد تكون رتبتي نازلة) — لم يتم خصم أي مبلغ',
        components: [],
        embeds: [],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.success)
          .setTitle('🛍️ تم الشراء بنجاح!')
          .setDescription(
            `اشتريت **${item.name}** بسعر **${formatNumber(item.price)}** 💰\n` +
            `أُضيفت إليك ${role}\n` +
            `رصيدك الآن: **${formatNumber(profile.balance)}**`
          )
          .setTimestamp(),
      ],
      components: [],
    });
  },
};

export default handler;
