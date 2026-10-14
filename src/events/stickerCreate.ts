// ============================================
// Liberty City Bot - Sticker Create Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'stickerCreate',
  async execute(sticker: any) {
    const client = sticker.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleStickerCreate(sticker).catch((err) => client.loggingHandler.reportFailure('stickerCreate', err));
  },
};

export default event;
