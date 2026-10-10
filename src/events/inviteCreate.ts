// ============================================
// Liberty City Bot - Invite Logging Events
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const inviteCreateEvent: Event = {
  name: 'inviteCreate',
  async execute(invite: any) {
    const client = invite.client as LibertyClient;
    await client.loggingHandler.handleInviteCreate(invite);
  },
};

export default inviteCreateEvent;
