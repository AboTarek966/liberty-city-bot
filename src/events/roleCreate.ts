// ============================================
// Liberty City Bot - Role Create Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'roleCreate',
  async execute(role: any) {
    const client = role.client as LibertyClient;
    // 🛡️ Anti-Create: أي بوت ينشئ رول → يُحذف فوراً
    await client.securityHandler.onRoleCreate(role).catch(() => {});
  },
};

export default event;
