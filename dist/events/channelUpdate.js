"use strict";
// ============================================
// Liberty City Bot - Channel Update Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel) {
        const client = newChannel.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleChannelUpdate(oldChannel, newChannel).catch((err) => client.loggingHandler.reportFailure('channelUpdate', err));
    },
};
exports.default = event;
//# sourceMappingURL=channelUpdate.js.map