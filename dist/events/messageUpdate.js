"use strict";
// ============================================
// Liberty City Bot - Message Edit Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        const client = newMessage.client;
        await client.loggingHandler.handleMessageEdit(oldMessage, newMessage);
    },
};
exports.default = event;
//# sourceMappingURL=messageUpdate.js.map