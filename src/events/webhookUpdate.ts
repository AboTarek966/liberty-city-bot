// ============================================
// Omni Bot - Webhook Update Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'webhookUpdate',
  async execute(webhook: any) {
    const client = webhook.client as OmniClient;
    await client.securityHandler.onWebhookUpdate(webhook).catch(() => {});

    // 📋 سجل الـ Webhooks
    client.loggingHandler?.handleWebhookUpdate(webhook).catch((err) => {
      client.loggingHandler?.reportFailure('webhookUpdate', err);
    });
  },
};

export default event;