// ============================================
// Liberty City Bot - Member Update Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildMemberUpdate',
  async execute(oldMember: any, newMember: any) {
    const client = newMember.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleGuildMemberUpdate(oldMember, newMember).catch((err) => client.loggingHandler.reportFailure('guildMemberUpdate', err));
  },
};

export default event;
