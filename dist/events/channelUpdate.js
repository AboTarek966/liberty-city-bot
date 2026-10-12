"use strict";
// ============================================
// Liberty City Bot - Channel Update Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel) {
        const client = newChannel.client;
        await client.loggingHandler.handleChannelUpdate(oldChannel, newChannel);
    },
};
exports.default = event;
//# sourceMappingURL=channelUpdate.js.map