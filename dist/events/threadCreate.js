"use strict";
// ============================================
// Omni Bot - Thread Create Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'threadCreate',
    async execute(thread) {
        const client = thread.client;
        await client.securityHandler.onThreadCreate(thread).catch(() => { });
        // 📋 سجل الـ Thread
        client.loggingHandler?.handleThreadCreate(thread).catch((err) => {
            client.loggingHandler?.reportFailure('threadCreate', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=threadCreate.js.map