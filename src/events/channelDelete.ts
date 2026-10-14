// ============================================
// Liberty City Bot - Channel Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'channelDelete',
  async execute(channel: any) {
    const client = channel.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleChannelDelete(channel).catch((err) => client.loggingHandler.reportFailure('channelDelete', err));
    // 🛡️ Anti-Nuke: رصد الحذف الجماعي
    await client.securityHandler.onChannelDelete(channel).catch(() => {});
  },
};

export default event;
