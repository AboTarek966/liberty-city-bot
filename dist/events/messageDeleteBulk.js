"use strict";
// ============================================
// Liberty City Bot - Bulk Message Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'messageDeleteBulk',
    async execute(messages, channel) {
        const client = (channel?.client ?? (Array.isArray(messages) ? messages[0]?.client : messages?.first?.()?.client));
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleMessageDeleteBulk(messages, channel).catch((err) => client.loggingHandler.reportFailure('messageDeleteBulk', err));
    },
};
exports.default = event;
//# sourceMappingURL=messageDeleteBulk.js.map