"use strict";
// ============================================
// Liberty City Bot - Thread Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'threadDelete',
    async execute(thread) {
        const client = thread.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleThreadDelete(thread).catch((err) => client.loggingHandler.reportFailure('threadDelete', err));
    },
};
exports.default = event;
//# sourceMappingURL=threadDelete.js.map