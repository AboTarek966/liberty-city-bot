// ============================================
// Liberty City Bot - Ticket Close Button
// ============================================

import { ButtonInteraction, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { Ticket } from '../../models';

const handler: ButtonHandler = {
  id: 'ticket_close',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    try {
      const ticket = await Ticket.findOne({ channelId: interaction.channelId });
      if (!ticket) {
        await interaction.reply({ content: '❌ لم يتم العثور على تذكرة في هذه القناة', ephemeral: true });
        return;
      }

      // التحقق من الصلاحيات
      const member = interaction.guild.members.cache.get(interaction.user.id) ??
        await interaction.guild.members.fetch(interaction.user.id);
      const isOwner = ticket.userId === interaction.user.id;
      const canManage = member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !canManage) {
        await interaction.reply({ content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة', ephemeral: true });
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
