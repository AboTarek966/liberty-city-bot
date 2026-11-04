// ============================================
// Omni Bot - Member Role Update Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'guildMemberUpdate',
  async execute(oldMember: any, newMember: any) {
    const client = newMember.client as OmniClient;
    await client.securityHandler.onGuildMemberUpdate(oldMember, newMember).catch(() => {});
  },
};

export default event;