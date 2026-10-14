// ============================================
// Liberty City Bot - Channel Update Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'channelUpdate',
  async execute(oldChannel: any, newChannel: any) {
    const client = newChannel.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleChannelUpdate(oldChannel, newChannel).catch((err) => client.loggingHandler.reportFailure('channelUpdate', err));
  },
};

export default event;
