// ============================================
// Liberty City Bot - Role Logging Events
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const roleCreateEvent: Event = {
  name: 'roleCreate',
  async execute(role: any) {
    const client = role.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleRoleCreate(role).catch((err) => client.loggingHandler.reportFailure('roleCreate', err));
  },
};

export default roleCreateEvent;
