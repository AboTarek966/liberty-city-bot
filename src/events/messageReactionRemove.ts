// Omni Bot - Message Reaction Remove Event
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'messageReactionRemove',
  async execute(reaction: any, user: any) {
    const client = reaction.message?.client as OmniClient | undefined;
    if (!client?.loggingHandler) return;
    await client.loggingHandler.handleReactionRemove(reaction, user).catch((err) => {
      client.loggingHandler.reportFailure('messageReactionRemove', err);
    });
  },
};

export default event;
