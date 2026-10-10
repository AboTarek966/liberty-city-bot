// ============================================
// Liberty City Bot - Channel Create Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'channelCreate',
  async execute(channel: any) {
    const client = channel.client as LibertyClient;
    await client.loggingHandler.handleChannelCreate(channel);
  },
};

export default event;
