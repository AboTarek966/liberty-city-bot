// ============================================
// Liberty City Bot - Ban Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildBanAdd',
  async execute(ban: any) {
    const client = ban.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleGuildBanAdd(ban).catch((err) => client.loggingHandler.reportFailure('guildBanAdd', err));
    // 🛡️ Anti-Nuke: رصد الحظر الجماعي
    await client.securityHandler.onBanAdd(ban).catch(() => {});
  },
};

export default event;
