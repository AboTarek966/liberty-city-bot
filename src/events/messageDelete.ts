// ============================================
// Liberty City Bot - Logging Events (All-in-one)
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

// Message Delete
const messageDeleteEvent: Event = {
  name: 'messageDelete',
  async execute(message: any) {
    const client = message.client as LibertyClient;
    await client.loggingHandler.handleMessageDelete(message);
  },
};

export default messageDeleteEvent;
