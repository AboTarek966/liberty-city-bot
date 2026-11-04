// Omni Bot - Message Reaction Remove All Event
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'messageReactionRemoveAll',
  async execute(message: any, reactions: any[]) {
    const client = message?.client as OmniClient | undefined;
    if (!client?.loggingHandler) return;
    await client.loggingHandler.handleReactionRemoveAll(message, reactions).catch((err) => {
      client.loggingHandler.reportFailure('messageReactionRemoveAll', err);
    });
  },
};

export default event;
