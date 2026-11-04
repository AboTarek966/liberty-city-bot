"use strict";
// ============================================
// Omni Bot - Webhook Update Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'webhookUpdate',
    async execute(webhook) {
        const client = webhook.client;
        await client.securityHandler.onWebhookUpdate(webhook).catch(() => { });
        // 📋 سجل الـ Webhooks
        client.loggingHandler?.handleWebhookUpdate(webhook).catch((err) => {
            client.loggingHandler?.reportFailure('webhookUpdate', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=webhookUpdate.js.map