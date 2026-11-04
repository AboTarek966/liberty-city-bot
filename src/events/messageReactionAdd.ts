// Omni Bot - Message Reaction Add Event
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'messageReactionAdd',
  async execute(reaction: any, user: any) {
    const client = reaction.message?.client as OmniClient | undefined;
    if (!client?.loggingHandler) return;
    await client.loggingHandler.handleReactionAdd(reaction, user).catch((err) => {
      client.loggingHandler.reportFailure('messageReactionAdd', err);
    });
  },
};

export default event;
