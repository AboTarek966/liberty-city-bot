// ============================================
// Liberty City Bot - Message Delete Bulk Event
// كشف الحذف الجماعي للرسائل (Anti-Mass-Delete)
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';

const logger = createLogger('Event:MessageDeleteBulk');

const event: Event = {
  name: 'messageDeleteBulk',
  async execute(messages: any) {
    const client = messages.first()?.client as LibertyClient;
    if (!client?.securityHandler) return;

    try {
      await client.securityHandler.onMessageDeleteBulk(messages);
    } catch (error: any) {
      logger.error(`messageDeleteBulk handler error: ${error.message}`);
    }
  },
};

export default event;