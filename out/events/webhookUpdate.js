"use strict";
// ============================================
// Liberty City Bot - Webhook Update Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'webhookUpdate',
    async execute(webhook) {
        const client = webhook.client;
        await client.securityHandler.onWebhookUpdate(webhook).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=webhookUpdate.js.map