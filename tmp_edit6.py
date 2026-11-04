p='src/utils/aiTicketActions.ts'
s=open(p,encoding='utf-8').read()
# type
s=s.replace(
"""    | 'timeout_user'
    | 'custom';""",
"""    | 'timeout_user'
    | 'close_ticket'
    | 'custom';""",1)
# actionNeedsApproval
s=s.replace(
"""  if (action.type === 'restore_backup') return true;""",
"""  if (action.type === 'restore_backup') return true;
  if (action.type === 'close_ticket') return true;""",1)
# execute case before custom
old_case="""      case 'check_settings': {"""
new_case="""      case 'close_ticket': {
        const closeChannelId =
          normalizeId(action.params?.channelId) || normalizeId(context.ticketChannelId);
        const closeChannel = closeChannelId
          ? (guild.channels.cache.get(closeChannelId) as TextChannel | undefined)
          : undefined;
        if (!closeChannel) return { ok: false, message: '❌ قناة التذكرة غير موجودة' };
        const closer = guild.members.me;
        if (!closer) return { ok: false, message: '❌ البوت غير متاح' };
        try {
          await (client as any).ticketHandler.closeTicket(
            closeChannel.id,
            closer,
            action.description || 'AI: تم حل المشكلة'
          );
          return { ok: true, message: '✅ تم إغلاق التذكرة' };
        } catch (error: any) {
          return { ok: false, message: `❌ فشل إغلاق التذكرة: ${error.message}` };
        }
      }

      case 'check_settings': {"""
assert old_case in s
s=s.replace(old_case,new_case,1)
open(p,'w',encoding='utf-8').write(s)
print("done")
