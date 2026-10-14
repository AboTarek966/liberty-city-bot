// ============================================
// Liberty City Bot - Invite Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'inviteDelete',
  async execute(invite: any) {
    const client = invite.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleInviteDelete(invite).catch((err) => client.loggingHandler.reportFailure('inviteDelete', err));
  },
};

export default event;
