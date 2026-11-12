"use strict";
// ============================================
// Omni Bot - Channel Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelDelete',
    async execute(channel) {
        const client = channel.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleChannelDelete(channel).catch((err) => client.loggingHandler.reportFailure('channelDelete', err));
        // 🗑️ لو انحذفت قناة تذكرة، نحددها «مغلقة» حتى ما تمنع فتح تذكرة جديدة لاحقاً
        client.ticketHandler?.cleanupTicketByDeletedChannel?.(channel.id, channel.guildId || channel.guild?.id).catch(() => { });
        // 🛡️ Anti-Nuke: رصد الحذف الجماعي
        await client.securityHandler.onChannelDelete(channel).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=channelDelete.js.map