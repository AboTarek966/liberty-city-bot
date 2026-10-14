"use strict";
// ============================================
// Liberty City Bot - Channel Create Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelCreate',
    async execute(channel) {
        const client = channel.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleChannelCreate(channel).catch((err) => client.loggingHandler.reportFailure('channelCreate', err));
    },
};
exports.default = event;
//# sourceMappingURL=channelCreate.js.map