// ============================================
// Liberty City Bot - Bulk Message Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'messageDeleteBulk',
  async execute(messages: any, channel: any) {
    const client = (channel?.client ?? (Array.isArray(messages) ? messages[0]?.client : messages?.first?.()?.client)) as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleMessageDeleteBulk(messages, channel).catch((err) => client.loggingHandler.reportFailure('messageDeleteBulk', err));
  },
};

export default event;
