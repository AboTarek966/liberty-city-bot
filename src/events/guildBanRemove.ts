// ============================================
// Liberty City Bot - Unban Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildBanRemove',
  async execute(ban: any) {
    const client = ban.client as LibertyClient;
    await client.loggingHandler.handleGuildBanRemove(ban);
  },
};

export default event;
