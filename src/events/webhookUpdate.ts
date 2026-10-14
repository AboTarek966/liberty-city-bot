// ============================================
// Liberty City Bot - Webhook Update Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'webhookUpdate',
  async execute(channel: any) {
    const client = channel.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleWebhookUpdate(channel).catch((err) => client.loggingHandler.reportFailure('webhookUpdate', err));
  },
};

export default event;
