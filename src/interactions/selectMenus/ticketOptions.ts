// ============================================
// Liberty City Bot - Ticket Options Menu (داخل التذكرة)
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
import { LibertyClient } from '../../LibertyClient';
import { Ticket } from '../../models';

const handler: SelectMenuHandler = {
  id: 'ticket_options',
  async execute(interaction) {
    const selectInteraction = interaction as StringSelectMenuInteraction;
    const client = selectInteraction.client as LibertyClient;
    if (!selectInteraction.guild || !selectInteraction.channelId) return;

    await selectInteraction.deferReply({ ephemeral: true });

    const action = selectInteraction.values[0];

    try {
      const member = await selectInteraction.guild.members.fetch(selectInteraction.user.id);

      switch (action) {
        // ---------- 🤝 استلام التذكرة ----------
        case 'claim': {
          if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await selectInteraction.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات لاستلام التذاكر' });
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

          const isOwner = ticket.userId === selectInteraction.user.id;
          const canManage = member.permissions.has(PermissionFlagsBits.ManageChannels);
          if (!isOwner && !canManage) {
            await selectInteraction.editReply({ content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة' });
            return;
          }

          await client.ticketHandler.closeTicket(
            selectInteraction.channelId,
            member,
            isOwner ? 'أُغلقت بواسطة صاحب التذكرة' : 'أُغلقت بواسطة المشرف'
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

          const isOwner = ticket.userId === selectInteraction.user.id;
          const canManage = member.permissions.has(PermissionFlagsBits.ManageChannels);
          if (!isOwner && !canManage) {
            await selectInteraction.editReply({ content: '❌ ليس لديك صلاحية لحذف هذه التذكرة' });
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
