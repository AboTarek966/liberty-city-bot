// ============================================
// Liberty City Bot - Ban Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildBanAdd',
  async execute(ban: any) {
    const client = ban.client as LibertyClient;
    await client.loggingHandler.handleGuildBanAdd(ban);
    // 🛡️ Anti-Nuke: رصد الحظر الجماعي
    await client.securityHandler.onBanAdd(ban).catch(() => {});
  },
};

export default event;
