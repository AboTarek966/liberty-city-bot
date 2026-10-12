"use strict";
// ============================================
// Liberty City Bot - Member Update Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        const client = newMember.client;
        await client.loggingHandler.handleGuildMemberUpdate(oldMember, newMember);
    },
};
exports.default = event;
//# sourceMappingURL=guildMemberUpdate.js.map