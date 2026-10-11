// ============================================
// Liberty City Bot - Logging Events (All-in-one)
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { recordDeletedMessage } from '../utils/snipeCache';

// Message Delete
const messageDeleteEvent: Event = {
  name: 'messageDelete',
  async execute(message: any) {
    const client = message.client as LibertyClient;
    // 🕵️ حفظ نسخة من الرسالة محذوفة (سنايب) قبل معالجة السجلات
    recordDeletedMessage(message);
    await client.loggingHandler.handleMessageDelete(message);
  },
};

export default messageDeleteEvent;
