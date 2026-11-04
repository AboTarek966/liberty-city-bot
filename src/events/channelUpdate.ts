// ============================================
// Omni Bot - Channel Update Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'channelUpdate',
  async execute(oldChannel: any, newChannel: any) {
    const client = newChannel.client as OmniClient;
    // 🛡️ Anti-Rename: تغيير اسم قناة بسرعة → رد على المنفذ
    await client.securityHandler.onChannelUpdate(oldChannel, newChannel).catch(() => {});
    // 🛡️ Anti-@everyone: منع إضافة صلاحيات خطيرة لـ @everyone
    await client.securityHandler.onChannelPermissionUpdate(oldChannel, newChannel).catch(() => {});
  },
};

export default event;
