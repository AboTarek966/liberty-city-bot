"use strict";
// ============================================
// Omni Bot - Channel Create Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelCreate',
    async execute(channel) {
        const client = channel.client;
        // 🛡️ Anti-Create: أي بوت ينشئ قناة → يُحذف فوراً
        await client.securityHandler.onChannelCreate(channel).catch(() => { });
        // 📋 سجل القناة المنشأة
        client.loggingHandler?.handleChannelCreate(channel).catch((err) => {
            client.loggingHandler?.reportFailure('channelCreate', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=channelCreate.js.map