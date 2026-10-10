// ============================================
// Liberty City Bot - Channel Update Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'channelUpdate',
  async execute(oldChannel: any, newChannel: any) {
    const client = newChannel.client as LibertyClient;
    await client.loggingHandler.handleChannelUpdate(oldChannel, newChannel);
  },
};

export default event;
