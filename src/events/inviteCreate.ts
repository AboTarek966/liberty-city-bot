// ============================================
// Omni Bot - Invite Logging Events
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const inviteCreateEvent: Event = {
  name: 'inviteCreate',
  async execute(invite: any) {
    const client = invite.client as OmniClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleInviteCreate(invite).catch((err) => client.loggingHandler.reportFailure('inviteCreate', err));
  },
};

export default inviteCreateEvent;
