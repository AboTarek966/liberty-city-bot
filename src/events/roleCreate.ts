// ============================================
// Liberty City Bot - Role Logging Events
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const roleCreateEvent: Event = {
  name: 'roleCreate',
  async execute(role: any) {
    const client = role.client as LibertyClient;
    await client.loggingHandler.handleRoleCreate(role);
  },
};

export default roleCreateEvent;
