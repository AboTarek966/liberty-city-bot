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

    // 📋 سجل تحديث العضو (رتب/أسماء/نيكنايم)
    client.loggingHandler?.handleGuildMemberUpdate(oldMember, newMember).catch((err) => {
      client.loggingHandler?.reportFailure('guildMemberUpdate', err);
    });
  },
};

export default event;