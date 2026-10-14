// ============================================
// Liberty City Bot - Unban Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildBanRemove',
  async execute(ban: any) {
    const client = ban.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleGuildBanRemove(ban).catch((err) => client.loggingHandler.reportFailure('guildBanRemove', err));
  },
};

export default event;
