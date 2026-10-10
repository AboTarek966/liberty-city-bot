// ============================================
// Liberty City Bot - Channel Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'channelDelete',
  async execute(channel: any) {
    const client = channel.client as LibertyClient;
    await client.loggingHandler.handleChannelDelete(channel);
    // 🛡️ Anti-Nuke: رصد الحذف الجماعي
    await client.securityHandler.onChannelDelete(channel).catch(() => {});
  },
};

export default event;
