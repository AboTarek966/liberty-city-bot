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

    // 📋 سجل الـ Thread
    client.loggingHandler?.handleThreadCreate(thread).catch((err) => {
      client.loggingHandler?.reportFailure('threadCreate', err);
    });
  },
};

export default event;