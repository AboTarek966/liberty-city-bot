"use strict";
// ============================================
// Liberty City Bot - Message Edit Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        const client = newMessage.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleMessageEdit(oldMessage, newMessage).catch((err) => client.loggingHandler.reportFailure('messageUpdate', err));
    },
};
exports.default = event;
//# sourceMappingURL=messageUpdate.js.map