// ============================================
// Omni Bot - Ticket Unclaim Button
// ============================================

import { ButtonInteraction, PermissionFlagsBits } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { OmniClient } from '../../OmniClient';
import { getGuildSettings } from '../../models';
import { isEnvBotOwner } from '../../utils/botOwner';

const handler: ButtonHandler = {
  id: 'ticket_unclaim',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as OmniClient;
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // ⚡ الكاش أولاً — تجنّب طلب شبكة إضافي قبل الرد
      const member =
        interaction.guild.members.cache.get(interaction.user.id) ??
        (await interaction.guild.members.fetch(interaction.user.id));

      const settings = await getGuildSettings(interaction.guild.id);
      const canUnclaim =
        isEnvBotOwner(member.id) ||
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageChannels) ||
        (settings.tickets.adminRoleIds || []).some((id: string) => member.roles.cache.has(id)) ||
        (settings.tickets.supportRoleIds || []).some((id: string) => member.roles.cache.has(id));

      if (!canUnclaim) {
        await interaction.editReply({ content: '❌ تحتاج أن تكون من فريق الدعم أو الإدارة لإلغاء الاستلام' });
        return;
      }

      await client.ticketHandler.unclaimTicket(interaction.channelId, member);
      await interaction.editReply({
        content: '↩️ تم إلغاء استلام التذكرة — يمكن لأي إداري آخر استلامها الآن',
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
      });
    }
  },
};

export default handler;
