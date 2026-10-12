"use strict";
// ============================================
// Liberty City Bot - Channel Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelDelete',
    async execute(channel) {
        const client = channel.client;
        await client.loggingHandler.handleChannelDelete(channel);
        // 🛡️ Anti-Nuke: رصد الحذف الجماعي
        await client.securityHandler.onChannelDelete(channel).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=channelDelete.js.map