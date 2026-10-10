// ============================================
// Liberty City Bot - Shop Command (متجر السيرفر)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings, UserProfile } from '../../models';
import { Colors } from '../../utils/embeds';
import { formatNumber } from '../../utils/helpers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('🛍️ متجر السيرفر — اشترِ رولات باستخدام رصيدك')
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const settings = await getGuildSettings(interaction.guildId!);
    const shop = settings.shop as any;
    const items = shop?.items || [];

    if (!shop?.enabled) {
      await interaction.editReply({ content: '🔒 المتجر مغلق حالياً — تواصل مع الإدارة' });
      return;
    }
    if (items.length === 0) {
      await interaction.editReply({ content: '🛍️ المتجر فارغ حالياً — تواصل مع الإدارة' });
      return;
    }

    const profile = await UserProfile.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
    }).catch(() => null);
    const balance = profile?.balance || 0;

    const list = items
      .map((it: any) => `> 🛍️ **${it.name}** — 💰 \`${formatNumber(it.price)}\` → <@&${it.roleId}>`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle('🛍️ متجر السيرفر')
      .setDescription(
        `**رصيدك الحالي:** 💰 \`${formatNumber(balance)}\`\n\n` +
        `${list}\n\n` +
        `اختر عنصراً من القائمة بالأسفل للشراء — سيُخصم المبلغ ويصلك الرول فوراً`
      )
      .setFooter({ text: 'اجمع الرصيد بـ /daily والنشر في الشات' })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId('shop_buy')
      .setPlaceholder('🛍️ اختر العنصر الذي تريد شراؤه')
      .addOptions(
        items.slice(0, 25).map((it: any) => ({
          label: `${it.name} — ${it.price}`,
          description: `سعر: ${it.price} عملة`,
          value: it.id,
        }))
      );

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder<any>().addComponents(select)],
    });
  },
};

export default command;
