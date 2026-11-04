// ============================================
// Omni Bot - Channel Create Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'channelCreate',
  async execute(channel: any) {
    const client = channel.client as OmniClient;
    // 🛡️ Anti-Create: أي بوت ينشئ قناة → يُحذف فوراً
    await client.securityHandler.onChannelCreate(channel).catch(() => {});
  },
};

export default event;
