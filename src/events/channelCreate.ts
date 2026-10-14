// ============================================
// Liberty City Bot - Channel Create Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'channelCreate',
  async execute(channel: any) {
    const client = channel.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleChannelCreate(channel).catch((err) => client.loggingHandler.reportFailure('channelCreate', err));
  },
};

export default event;
