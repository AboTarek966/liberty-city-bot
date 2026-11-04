"use strict";
// Omni Bot - Message Reaction Remove All Event
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'messageReactionRemoveAll',
    async execute(message, reactions) {
        const client = message?.client;
        if (!client?.loggingHandler)
            return;
        await client.loggingHandler.handleReactionRemoveAll(message, reactions).catch((err) => {
            client.loggingHandler.reportFailure('messageReactionRemoveAll', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=messageReactionRemoveAll.js.map