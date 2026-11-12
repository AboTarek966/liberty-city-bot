// ============================================
// Omni Bot - Ticket Close Button
// ============================================

import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { OmniClient } from '../../OmniClient';
import { Ticket } from '../../models';

const handler: ButtonHandler = {
  id: 'ticket_close',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as OmniClient;
    if (!interaction.guild) return;

    try {
      const ticket = await Ticket.findOne({ channelId: interaction.channelId });
      if (!ticket) {
        await interaction.reply({ content: '❌ لم يتم العثور على تذكرة في هذه القناة', ephemeral: true });
        return;
      }

      // التحقق من الصلاحيات — الإغلاق لفريق الدعم/الإدارة فقط
      const member = interaction.guild.members.cache.get(interaction.user.id) ??
        await interaction.guild.members.fetch(interaction.user.id);

      if (!(await client.ticketHandler.isStaff(member))) {
        await interaction.reply({ content: '❌ إغلاق التذاكر متاح لفريق الدعم والإدارة فقط', ephemeral: true });
        return;
      }

      // إظهار Modal لكتابة السبب
      const modal = new ModalBuilder()
        .setCustomId(`ticket_close_modal:${ticket._id}`)
        .setTitle('🔒 إغلاق التذكرة');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('سبب الإغلاق (اختياري)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('اكتب سبب الإغلاق هنا...')
        .setRequired(false)
        .setMaxLength(500);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    } catch (error: any) {
      await interaction.reply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
        ephemeral: true,
      });
    }
  },
};

export default handler;
