// ============================================
// Liberty City Bot - Invite Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'inviteDelete',
  async execute(invite: any) {
    const client = invite.client as LibertyClient;
    await client.loggingHandler.handleInviteDelete(invite);
  },
};

export default event;
