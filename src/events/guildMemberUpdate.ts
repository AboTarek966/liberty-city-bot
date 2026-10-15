// ============================================
// Liberty City Bot - Member Role Update Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildMemberUpdate',
  async execute(oldMember: any, newMember: any) {
    const client = newMember.client as LibertyClient;
    await client.securityHandler.onGuildMemberUpdate(oldMember, newMember).catch(() => {});
  },
};

export default event;