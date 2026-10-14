"use strict";
// ============================================
// Liberty City Bot - Thread Update Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'threadUpdate',
    async execute(oldThread, newThread) {
        const client = newThread.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleThreadUpdate(oldThread, newThread).catch((err) => client.loggingHandler.reportFailure('threadUpdate', err));
    },
};
exports.default = event;
//# sourceMappingURL=threadUpdate.js.map