// ============================================
// Omni Bot - Unban Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'guildBanRemove',
  async execute(ban: any) {
    const client = ban.client as OmniClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleGuildBanRemove(ban).catch((err) => client.loggingHandler.reportFailure('guildBanRemove', err));
  },
};

export default event;
