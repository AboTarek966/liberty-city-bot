// ============================================
// Liberty City Bot - Thread Create Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'threadCreate',
  async execute(thread: any) {
    const client = thread.client as LibertyClient;
    await client.securityHandler.onThreadCreate(thread).catch(() => {});
  },
};

export default event;