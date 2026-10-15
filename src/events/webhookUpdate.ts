// ============================================
// Liberty City Bot - Webhook Update Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'webhookUpdate',
  async execute(webhook: any) {
    const client = webhook.client as LibertyClient;
    await client.securityHandler.onWebhookUpdate(webhook).catch(() => {});
  },
};

export default event;