"use strict";
// ============================================
// Liberty City Bot - Thread Create Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'threadCreate',
    async execute(thread) {
        const client = thread.client;
        await client.securityHandler.onThreadCreate(thread).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=threadCreate.js.map