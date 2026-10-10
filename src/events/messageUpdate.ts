// ============================================
// Liberty City Bot - Message Edit Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'messageUpdate',
  async execute(oldMessage: any, newMessage: any) {
    const client = newMessage.client as LibertyClient;
    await client.loggingHandler.handleMessageEdit(oldMessage, newMessage);
  },
};

export default event;
