"use strict";
// ============================================
// Liberty City Bot - Invite Logging Events
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const inviteCreateEvent = {
    name: 'inviteCreate',
    async execute(invite) {
        const client = invite.client;
        await client.loggingHandler.handleInviteCreate(invite);
    },
};
exports.default = inviteCreateEvent;
//# sourceMappingURL=inviteCreate.js.map