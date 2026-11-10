// ============================================
// Omni Bot - Giveaway Entry Button
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings } from '../../models';
import { toggleGiveawayEntry } from '../../utils/giveaway';

const handler: ButtonHandler = {
  id: 'giveaway:entry',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const shortId = interaction.customId.split(':')[2];
    if (!shortId) {
      await interaction.reply({ content: '❌ زر سحب غير صالح', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const settings = await getGuildSettings(interaction.guild.id).catch(() => null);
    if (settings?.giveaways && settings.giveaways.enabled === false) {
      await interaction.editReply({ content: '⚠️ نظام السحوبات معطّل حالياً في هذا السيرفر' });
      return;
    }

    const member =
      interaction.guild.members.cache.get(interaction.user.id) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (!member) {
      await interaction.editReply({ content: '❌ لم يتم العثور على عضويتك' });
      return;
    }

    const result = await toggleGiveawayEntry(
      interaction.client,
      interaction.guild.id,
      shortId,
      member
    );

    if (!result.ok) {
      await interaction.editReply({ content: `❌ ${result.reason}` });
      return;
    }

    if (result.left) {
      await interaction.editReply({
        content: `🚪 **تم انسحابك من السحب** — يمكنك المشاركة مجدداً في أي وقت قبل انتهائه.`,
      });
      return;
    }

    await interaction.editReply({
      content:
        `🎉 **تم تسجيل مشاركتك!**\n` +
        `> 🎁 الجائزة: **${result.giveaway?.prize}**\n` +
        `> 👥 عدد المشاركين الآن: \`${result.giveaway ? new Set(result.giveaway.entries.map(String)).size : 0}\`\n\n` +
        `حظاً موفقاً! 🍀`,
    });
  },
};

export default handler;
