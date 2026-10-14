"use strict";
// ============================================
// Liberty City Bot - Webhook Update Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'webhookUpdate',
    async execute(channel) {
        const client = channel.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleWebhookUpdate(channel).catch((err) => client.loggingHandler.reportFailure('webhookUpdate', err));
    },
};
exports.default = event;
//# sourceMappingURL=webhookUpdate.js.map