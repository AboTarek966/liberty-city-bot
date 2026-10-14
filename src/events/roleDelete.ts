// ============================================
// Liberty City Bot - Role Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'roleDelete',
  async execute(role: any) {
    const client = role.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleRoleDelete(role).catch((err) => client.loggingHandler.reportFailure('roleDelete', err));
    // 🛡️ Anti-Nuke: رصد الحذف الجماعي للرولات
    await client.securityHandler.onRoleDelete(role).catch(() => {});
  },
};

export default event;
