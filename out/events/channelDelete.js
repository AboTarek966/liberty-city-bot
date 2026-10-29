"use strict";
// ============================================
// Liberty City Bot - Channel Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelDelete',
    async execute(channel) {
        const client = channel.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleChannelDelete(channel).catch((err) => client.loggingHandler.reportFailure('channelDelete', err));
        // 🛡️ Anti-Nuke: رصد الحذف الجماعي
        await client.securityHandler.onChannelDelete(channel).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=channelDelete.js.map