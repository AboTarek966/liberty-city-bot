"use strict";
// ============================================
// Omni Bot - Member Role Update Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        const client = newMember.client;
        await client.securityHandler.onGuildMemberUpdate(oldMember, newMember).catch(() => { });
        // 📋 سجل تحديث العضو (رتب/أسماء/نيكنايم)
        client.loggingHandler?.handleGuildMemberUpdate(oldMember, newMember).catch((err) => {
            client.loggingHandler?.reportFailure('guildMemberUpdate', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=guildMemberUpdate.js.map