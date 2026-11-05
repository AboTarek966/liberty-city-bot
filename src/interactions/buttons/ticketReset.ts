// ============================================
// Omni Bot - Ticket Reset (إعادة تعيين الاختيار)
// يعيد ضبط اختيار نوع التذكرة في اللوحة فقط —
// لا يحذف التذكرة المفتوحة ولا يغلقها.
// ============================================

import {
  ButtonInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { OmniClient } from '../../OmniClient';
import { getGuildSettings } from '../../models';

const handler: ButtonHandler = {
  id: 'ticket_reset',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const client = interaction.client as OmniClient;

    try {
      // 🔎 استخراج معرّف اللوحة من قائمة الاختيار داخل الرسالة
      let selectCustomId: string | undefined;
      for (const row of interaction.message.components as any[]) {
        for (const comp of row.components || []) {
          if (typeof comp.customId === 'string' && comp.customId.startsWith('ticket_select_')) {
            selectCustomId = comp.customId;
            break;
          }
        }
        if (selectCustomId) break;
      }

      if (!selectCustomId) {
        await interaction.reply({
          content: '❌ لم أجد قائمة أنواع التذاكر في هذه اللوحة.',
          ephemeral: true,
        });
        return;
      }

      const panelId = selectCustomId.replace('ticket_select_', '');
      const settings = await getGuildSettings(interaction.guild.id).catch(() => null);
      const panel = (settings?.tickets?.panels || []).find((p: any) => p.id === panelId);

      let components: any[];
      if (panel) {
        // ✅ إعادة بناء اللوحة من الإعدادات = قائمة اختيار جديدة بلا تحديد
        components = client.ticketHandler.buildPanelComponents(panel as any);
      } else {
        // 🔁 احتياطي: إعادة بناء قائمة الاختيار من نفس الرسالة
        components = (interaction.message.components as any[]).map((row) => {
          const comp = (row.components || []).find(
            (c: any) => typeof c.customId === 'string' && c.customId.startsWith('ticket_select_')
          );
          if (!comp) return row;

          const menu = new StringSelectMenuBuilder()
            .setCustomId(comp.customId)
            .setPlaceholder(comp.placeholder || '🎫 اختر نوع التذكرة');

          const options = (comp.options || [])
            .slice(0, 25)
            .map((o: any) => ({
              label: o.label,
              value: o.value,
              description: o.description || undefined,
              emoji: o.emoji?.id ? o.emoji : undefined,
            }))
            .filter((o: any) => o.label && o.value);

          if (options.length > 0) menu.addOptions(options);
          return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
        });
      }

      // 🖥️ تحديث نفس رسالة اللوحة — يمسح التحديد من القائمة
      await interaction.update({ components });

      await interaction
        .followUp({
          content: '🔄 تم إلغاء الاختيار — اختر نوع التذكرة من جديد.\n(تذكرتك المفتوحة لم تُحذف ولم تُغلق)',
          ephemeral: true,
        })
        .catch(() => {});
    } catch (error: any) {
      await interaction
        .followUp({ content: `❌ حدث خطأ: ${error.message || 'غير معروف'}`, ephemeral: true })
        .catch(() => {});
    }
  },
};

export default handler;
