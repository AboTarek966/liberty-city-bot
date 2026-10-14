// ============================================
// Liberty City Bot - Thread Update Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'threadUpdate',
  async execute(oldThread: any, newThread: any) {
    const client = newThread.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleThreadUpdate(oldThread, newThread).catch((err) => client.loggingHandler.reportFailure('threadUpdate', err));
  },
};

export default event;
