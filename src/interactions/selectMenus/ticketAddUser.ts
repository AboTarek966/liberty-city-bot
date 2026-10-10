// ============================================
// Liberty City Bot - Ticket Add User (UserSelectMenu)
// اختيار أعضاء من قائمة لإضافتهم للتذكرة (بديل حديث عن المودال)
// ============================================

import {
  UserSelectMenuInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';

const handler: SelectMenuHandler = {
  id: 'ticket_add_user',
  async execute(interaction) {
    const userSelect = interaction as UserSelectMenuInteraction;
    const client = userSelect.client as LibertyClient;
    if (!userSelect.guild || !userSelect.channelId) return;

    await userSelect.deferReply({ ephemeral: true });

    try {
      const byMember = await userSelect.guild.members.fetch(userSelect.user.id);
      if (!byMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await userSelect.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات لإضافة أعضاء' });
        return;
      }

      const added: string[] = [];
      const skipped: string[] = [];

      for (const userId of userSelect.values.slice(0, 5)) {
        if (userId === userSelect.user.id) {
          skipped.push('نفسك');
          continue;
        }

        const member = await userSelect.guild.members.fetch(userId).catch(() => null);
        if (!member) {
          skipped.push(`<@${userId}>`);
          continue;
        }
        if (member.user.bot) {
          skipped.push(`${member} (بوت)`);
          continue;
        }

        await client.ticketHandler.addMemberToTicket(userSelect.channelId!, member, byMember as any);
        added.push(member.toString());
      }

      const parts: string[] = [];
      if (added.length > 0) parts.push(`✅ تمت إضافة: ${added.join(' ')}`);
      if (skipped.length > 0) parts.push(`⚠️ تم تجاهل: ${skipped.join(' ')}`);

      await userSelect.editReply({ content: parts.join('\n') || '❌ لم تتم إضافة أحد' });
    } catch (error: any) {
      await userSelect.editReply({ content: `❌ ${error.message || 'حدث خطأ'}` });
    }
  },
};

export default handler;
