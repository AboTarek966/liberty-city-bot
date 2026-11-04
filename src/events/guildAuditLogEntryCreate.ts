// ============================================
// Omni Bot - Guild Audit Log Entry Create
// ⚡ بثّ سجلات التدقيق الفوري من Gateway:
//    يصل السجل مع الحدث نفسه (بدون REST) → استجابة فورية جداً
//    يُستخدم لتحديد المنفّذ فوراً + كشف البوتات وتحييدها قبل أن تكمل
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'guildAuditLogEntryCreate',
  async execute(entry: any, guild: any) {
    const client = (guild?.client ?? entry?.guild?.client ?? entry?.client) as OmniClient;
    if (!client?.securityHandler) return;
    // ⚡ لا ننتظر — المعالجة بالخلفية حتى لا نؤخّر أي حدث آخر
    client.securityHandler.onAuditEntry(entry, guild).catch(() => {});

    // 📋 سجل Audit Log (كل إجراء إداري تقريباً)
    client.loggingHandler?.handleAuditLogEntryCreate(entry, guild).catch((err) => {
      client.loggingHandler?.reportFailure('guildAuditLogEntryCreate', err);
    });
  },
};

export default event;
