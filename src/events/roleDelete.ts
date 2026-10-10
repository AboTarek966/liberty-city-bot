// ============================================
// Liberty City Bot - Role Delete Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'roleDelete',
  async execute(role: any) {
    const client = role.client as LibertyClient;
    await client.loggingHandler.handleRoleDelete(role);
    // 🛡️ Anti-Nuke: رصد الحذف الجماعي للرولات
    await client.securityHandler.onRoleDelete(role).catch(() => {});
  },
};

export default event;
