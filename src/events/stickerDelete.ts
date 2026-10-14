// ============================================
// Liberty City Bot - Sticker Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'stickerDelete',
  async execute(sticker: any) {
    const client = sticker.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleStickerDelete(sticker).catch((err) => client.loggingHandler.reportFailure('stickerDelete', err));
  },
};

export default event;
