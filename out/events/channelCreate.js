"use strict";
// ============================================
// Liberty City Bot - Channel Create Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelCreate',
    async execute(channel) {
        const client = channel.client;
        // 🛡️ Anti-Create: أي بوت ينشئ قناة → يُحذف فوراً
        await client.securityHandler.onChannelCreate(channel).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=channelCreate.js.map