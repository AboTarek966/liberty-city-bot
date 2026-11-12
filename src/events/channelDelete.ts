// ============================================
// Omni Bot - Channel Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'channelDelete',
  async execute(channel: any) {
    const client = channel.client as OmniClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleChannelDelete(channel).catch((err) => client.loggingHandler.reportFailure('channelDelete', err));
    // 🗑️ لو انحذفت قناة تذكرة، نحددها «مغلقة» حتى ما تمنع فتح تذكرة جديدة لاحقاً
    client.ticketHandler?.cleanupTicketByDeletedChannel?.(channel.id, channel.guildId || channel.guild?.id).catch(() => {});
    // 🛡️ Anti-Nuke: رصد الحذف الجماعي
    await client.securityHandler.onChannelDelete(channel).catch(() => {});
  },
};

export default event;
