// ============================================
// Liberty City Bot - Emoji Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'emojiDelete',
  async execute(emoji: any) {
    const client = emoji.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleEmojiDelete(emoji).catch((err) => client.loggingHandler.reportFailure('emojiDelete', err));
  },
};

export default event;
