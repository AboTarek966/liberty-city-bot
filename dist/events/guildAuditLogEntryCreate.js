"use strict";
// ============================================
// Liberty City Bot - Guild Audit Log Entry Create
// ⚡ بثّ سجلات التدقيق الفوري من Gateway:
//    يصل السجل مع الحدث نفسه (بدون REST) → استجابة فورية جداً
//    يُستخدم لتحديد المنفّذ فوراً + كشف البوتات وتحييدها قبل أن تكمل
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildAuditLogEntryCreate',
    async execute(entry, guild) {
        const client = (guild?.client ?? entry?.guild?.client ?? entry?.client);
        if (!client?.securityHandler)
            return;
        // ⚡ لا ننتظر — المعالجة بالخلفية حتى لا نؤخّر أي حدث آخر
        client.securityHandler.onAuditEntry(entry, guild).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=guildAuditLogEntryCreate.js.map