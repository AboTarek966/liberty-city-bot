// ============================================
// Liberty City Bot - Guild Audit Log Entry Create
// ⚡ بثّ سجلات التدقيق الفوري من Gateway:
//    يصل السجل مع الحدث نفسه (بدون REST) → استجابة فورية جداً
//    يُستخدم لتحديد المنفّذ فوراً + كشف البوتات وتحييدها قبل أن تكمل
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildAuditLogEntryCreate',
  async execute(entry: any, guild: any) {
    const client = (guild?.client ?? entry?.guild?.client ?? entry?.client) as LibertyClient;
    if (!client?.securityHandler) return;
    // ⚡ لا ننتظر — المعالجة بالخلفية حتى لا نؤخّر أي حدث آخر
    client.securityHandler.onAuditEntry(entry, guild).catch(() => {});
  },
};

export default event;
