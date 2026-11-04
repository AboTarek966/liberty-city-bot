// ============================================
// Omni Bot - Role Update (Logging + Anti-Admin)
// ============================================

import { Role } from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'roleUpdate',
  async execute(oldRole: Role, newRole: Role) {
    const client = newRole.client as OmniClient;
    // 📋 سجل تعديل الرولات
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleRoleUpdate(oldRole, newRole).catch((err) => client.loggingHandler.reportFailure('roleUpdate', err));
    // 🛡️ Anti-Admin: تنبيه عند منح صلاحية Administrator
    await client.securityHandler.onRoleUpdate(oldRole, newRole).catch(() => {});
  },
};

export default event;
