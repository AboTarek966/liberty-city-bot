// ============================================
// Liberty City Bot - Thread Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'threadDelete',
  async execute(thread: any) {
    const client = thread.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleThreadDelete(thread).catch((err) => client.loggingHandler.reportFailure('threadDelete', err));
  },
};

export default event;
