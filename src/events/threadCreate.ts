// ============================================
// Omni Bot - Thread Create Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'threadCreate',
  async execute(thread: any) {
    const client = thread.client as OmniClient;
    await client.securityHandler.onThreadCreate(thread).catch(() => {});
  },
};

export default event;