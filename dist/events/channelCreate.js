"use strict";
// ============================================
// Liberty City Bot - Channel Create Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'channelCreate',
    async execute(channel) {
        const client = channel.client;
        await client.loggingHandler.handleChannelCreate(channel);
    },
};
exports.default = event;
//# sourceMappingURL=channelCreate.js.map