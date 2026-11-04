// ============================================
// Omni Bot - Thread Update Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'threadUpdate',
  async execute(oldThread: any, newThread: any) {
    const client = newThread.client as OmniClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleThreadUpdate(oldThread, newThread).catch((err) => client.loggingHandler.reportFailure('threadUpdate', err));
  },
};

export default event;
