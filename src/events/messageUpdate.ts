// ============================================
// Omni Bot - Message Edit Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'messageUpdate',
  async execute(oldMessage: any, newMessage: any) {
    const client = newMessage.client as OmniClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleMessageEdit(oldMessage, newMessage).catch((err) => client.loggingHandler.reportFailure('messageUpdate', err));
  },
};

export default event;
