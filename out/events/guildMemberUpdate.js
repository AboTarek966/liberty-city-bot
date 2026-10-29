"use strict";
// ============================================
// Liberty City Bot - Member Role Update Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        const client = newMember.client;
        await client.securityHandler.onGuildMemberUpdate(oldMember, newMember).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=guildMemberUpdate.js.map