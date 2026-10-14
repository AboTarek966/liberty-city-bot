// ============================================
// Liberty City Bot - Thread Create Logging
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'threadCreate',
  async execute(thread: any, newlyCreated: boolean) {
    // التلقائية (منشورات المنتجات / متابعة الإعلانات) ليست قرار إنساني → لا نسجّلها
    if (!newlyCreated) return;

    const client = thread.client as LibertyClient;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleThreadCreate(thread).catch((err) => client.loggingHandler.reportFailure('threadCreate', err));
  },
};

export default event;
