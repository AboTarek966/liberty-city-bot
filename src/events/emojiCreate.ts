// ============================================
// Omni Bot - Emoji Create Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'emojiCreate',
  async execute(emoji: any) {
    const client = emoji.client as OmniClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleEmojiCreate(emoji).catch((err) => client.loggingHandler.reportFailure('emojiCreate', err));
  },
};

export default event;
