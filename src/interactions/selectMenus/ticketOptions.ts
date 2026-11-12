// ============================================
// Omni Bot - Ticket Options Menu (داخل التذكرة)
// قائمة "خيارات" واحدة لاستبدال أوامر / والأزرار:
// إضافة عضو/إداري، استدعاء الإدارة العليا، استلام/إلغاء، إغلاق، حذف، نسخة
// ============================================

import {
  StringSelectMenuInteraction,
  PermissionFlagsBits,
  AttachmentBuilder,
  ActionRowBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { OmniClient } from '../../OmniClient';
import { Ticket, getGuildSettings } from '../../models';

const handler: SelectMenuHandler = {
  id: 'ticket_options',
  async execute(interaction) {
    const selectInteraction = interaction as StringSelectMenuInteraction;
    const client = selectInteraction.client as OmniClient;
    if (!selectInteraction.guild || !selectInteraction.channelId) return;

    await selectInteraction.deferReply({ ephemeral: true });

    const action = selectInteraction.values[0];

    try {
      const member = await selectInteraction.guild.members.fetch(selectInteraction.user.id);

      switch (action) {
        // ---------- 🤝 استلام التذكرة ----------
        case 'claim': {
          const settings = await getGuildSettings(selectInteraction.guild.id);
          const canClaim =
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            member.permissions.has(PermissionFlagsBits.ManageChannels) ||
            (settings.tickets.adminRoleIds || []).some((id: string) => member.roles.cache.has(id)) ||
            (settings.tickets.supportRoleIds || []).some((id: string) => member.roles.cache.has(id));
          if (!canClaim) {
            await selectInteraction.editReply({ content: '❌ تحتاج أن تكون من فريق الدعم أو الإدارة لاستلام التذاكر' });
            return;
          }
          await client.ticketHandler.claimTicket(selectInteraction.channelId, member);
          await selectInteraction.editReply({ content: '🤝 تم استلام التذكرة بنجاح' });
          break;
        }

        // ---------- ↩️ إلغاء الاستلام ----------
        case 'unclaim': {
          await client.ticketHandler.unclaimTicket(selectInteraction.channelId, member);
          await selectInteraction.editReply({ content: '↩️ تم إلغاء استلام التذكرة' });
          break;
        }

        // ---------- 👑 استدعاء الإدارة العليا ----------
        case 'call_admin': {
          await client.ticketHandler.callAdmin(selectInteraction.channelId, member);
          await selectInteraction.editReply({ content: '🔔 تم استدعاء الإدارة العليا!' });
          break;
        }

        // ---------- ➕ إضافة عضو أو إداري ----------
        case 'add_member': {
          const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
            new UserSelectMenuBuilder()
              .setCustomId('ticket_add_user')
              .setPlaceholder('👥 اختر العضو أو الإداري المراد إضافته')
              .setMinValues(1)
              .setMaxValues(5)
          );

          await selectInteraction.editReply({
            content: '👥 اختر من القائمة بالأسفل العضو أو الإداريين المراد إضافتهم لهذه التذكرة:',
            components: [row],
          });
          break;
        }

        // ---------- 📄 نسخة من المحادثة ----------
        case 'transcript': {
          const transcript = await client.ticketHandler.getTranscript(selectInteraction.channelId);
          const attachment = new AttachmentBuilder(
            Buffer.from(transcript, 'utf-8'),
            { name: `transcript-${selectInteraction.channelId.slice(-6)}.txt` }
          );

          await selectInteraction.editReply({
            content: '📄 نسخة المحادثة:',
            files: [attachment],
          });
          break;
        }

        // ---------- 🔒 إغلاق التذكرة ----------
        case 'close': {
          const ticket = await Ticket.findOne({ channelId: selectInteraction.channelId });
          if (!ticket) {
            await selectInteraction.editReply({ content: '❌ لم يتم العثور على تذكرة في هذه القناة' });
            return;
          }

          // الإغلاق لفريق الدعم/الإدارة فقط
          if (!(await client.ticketHandler.isStaff(member))) {
            await selectInteraction.editReply({ content: '❌ إغلاق التذاكر متاح لفريق الدعم والإدارة فقط' });
            return;
          }

          await client.ticketHandler.closeTicket(
            selectInteraction.channelId,
            member,
            'أُغلقت بواسطة فريق الدعم'
          );
          await selectInteraction.editReply({ content: '🔒 تم إغلاق التذكرة بنجاح' });
          break;
        }

        // ---------- 🗑️ حذف التذكرة ----------
        case 'delete': {
          const ticket = await Ticket.findOne({ channelId: selectInteraction.channelId });
          if (!ticket) {
            await selectInteraction.editReply({ content: '❌ لم يتم العثور على تذكرة' });
            return;
          }

          // الحذف النهائي لفريق الدعم/الإدارة فقط
          if (!(await client.ticketHandler.isStaff(member))) {
            await selectInteraction.editReply({ content: '❌ حذف التذاكر متاح لفريق الدعم والإدارة فقط' });
            return;
          }

          await selectInteraction.editReply({ content: '🗑️ جارٍ حذف التذكرة...' });
          await client.ticketHandler.deleteTicket(selectInteraction.channelId, member);
          break;
        }

        default:
          await selectInteraction.editReply({ content: '❌ إجراء غير معروف' });
      }
    } catch (error: any) {
      await selectInteraction.editReply({
        content: `❌ ${error.message || 'حدث خطأ'}`,
      });
    }
  },
};

export default handler;
