// ============================================
// Omni Bot - Message Delete Bulk Event
// كشف الحذف الجماعي للرسائل (Anti-Mass-Delete)
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';
import { createLogger } from '../utils/helpers';

const logger = createLogger('Event:MessageDeleteBulk');

const event: Event = {
  name: 'messageDeleteBulk',
  async execute(messages: any) {
    const client = messages.first()?.client as OmniClient;
    if (!client?.securityHandler) return;

    try {
      await client.securityHandler.onMessageDeleteBulk(messages);
    } catch (error: any) {
      logger.error(`messageDeleteBulk handler error: ${error.message}`);
    }

    // 📋 سجل الحذف الجماعي
    try {
      const channel = messages?.first?.()?.channel;
      client.loggingHandler?.handleMessageDeleteBulk(messages, channel).catch((err) => {
        client.loggingHandler?.reportFailure('messageDeleteBulk', err);
      });
    } catch {
      /* السجل اختياري */
    }
  },
};

export default event;