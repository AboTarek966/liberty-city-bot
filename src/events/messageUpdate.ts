// ============================================
// Omni Bot - Message Edit Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';
import { handleBotAbuse } from '../utils/botAbuse';

const event: Event = {
  name: 'messageUpdate',
  async execute(oldMessage: any, newMessage: any) {
    const client = newMessage.client as OmniClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleMessageEdit(oldMessage, newMessage).catch((err) => client.loggingHandler.reportFailure('messageUpdate', err));

    // 🤖 لو عدّل الرسالة إلى سب للبوت بعد إرسالها — نطبّق نفس الحماية
    if (
      newMessage.guild &&
      !newMessage.author?.bot &&
      typeof newMessage.content === 'string' &&
      newMessage.content &&
      typeof oldMessage.content === 'string' &&
      newMessage.content !== oldMessage.content
    ) {
      handleBotAbuse(newMessage).catch((error: any) => {
        client.loggingHandler.reportFailure('messageUpdate:antiBotAbuse', error);
      });
    }
  },
};

export default event;
