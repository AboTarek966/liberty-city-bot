// ============================================
// Liberty City Bot - Member Update Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildMemberUpdate',
  async execute(oldMember: any, newMember: any) {
    const client = newMember.client as LibertyClient;
    await client.loggingHandler.handleGuildMemberUpdate(oldMember, newMember);
  },
};

export default event;
