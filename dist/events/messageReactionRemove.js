"use strict";
// Omni Bot - Message Reaction Remove Event
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        const client = reaction.message?.client;
        if (!client?.loggingHandler)
            return;
        await client.loggingHandler.handleReactionRemove(reaction, user).catch((err) => {
            client.loggingHandler.reportFailure('messageReactionRemove', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=messageReactionRemove.js.map