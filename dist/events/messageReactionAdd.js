"use strict";
// Omni Bot - Message Reaction Add Event
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {
        const client = reaction.message?.client;
        if (!client?.loggingHandler)
            return;
        await client.loggingHandler.handleReactionAdd(reaction, user).catch((err) => {
            client.loggingHandler.reportFailure('messageReactionAdd', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=messageReactionAdd.js.map