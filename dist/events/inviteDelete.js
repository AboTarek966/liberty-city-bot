"use strict";
// ============================================
// Liberty City Bot - Invite Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'inviteDelete',
    async execute(invite) {
        const client = invite.client;
        await client.loggingHandler.handleInviteDelete(invite);
    },
};
exports.default = event;
//# sourceMappingURL=inviteDelete.js.map