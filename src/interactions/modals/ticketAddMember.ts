// ============================================
// Liberty City Bot - Ticket Add Member Modal
// ============================================

import { ModalSubmitInteraction, PermissionFlagsBits } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';

const handler: ModalHandler = {
  id: 'ticket_add_member_modal',
  async execute(interaction: ModalSubmitInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true }); // ✅ منع انتهاء الصلاحية

    const raw = interaction.fields.getTextInputValue('member_id').trim();

    // Extract ID from mention or raw ID
    const idMatch = raw.match(/^<@!?(\d+)>$/) || raw.match(/^(\d+)$/);
    if (!idMatch) {
      await interaction.editReply({
        content: '❌ معرّف غير صالح. استخدم رقم المعرّف أو المنشن',
      });
      return;
    }

    const userId = idMatch[1];

    try {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
        return;
      }

      if (member.user.bot) {
        await interaction.editReply({ content: '❌ لا يمكن إضافة بوت' });
        return;
      }

      const byMember = await interaction.guild.members.fetch(interaction.user.id);
      if (!byMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات' });
        return;
      }

      if (!interaction.channelId) {
        await interaction.editReply({ content: '❌ هذه التذكرة غير صالحة' });
        return;
      }

      await client.ticketHandler.addMemberToTicket(interaction.channelId, member, byMember as any);
      await interaction.editReply({
        content: `✅ تمت إضافة ${member} للتذكرة`,
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
      });
    }
  },
};

export default handler;
