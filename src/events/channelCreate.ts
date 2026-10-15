// ============================================
// Liberty City Bot - Channel Create Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'channelCreate',
  async execute(channel: any) {
    const client = channel.client as LibertyClient;
    // 🛡️ Anti-Create: أي بوت ينشئ قناة → يُحذف فوراً
    await client.securityHandler.onChannelCreate(channel).catch(() => {});
  },
};

export default event;
