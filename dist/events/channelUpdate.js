"use strict";
// ============================================
// Liberty City Bot - Channel Update Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel) {
        const client = newChannel.client;
        // 🛡️ Anti-Rename: تغيير اسم قناة بسرعة → رد على المنفذ
        await client.securityHandler.onChannelUpdate(oldChannel, newChannel).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=channelUpdate.js.map