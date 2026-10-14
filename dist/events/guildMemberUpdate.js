"use strict";
// ============================================
// Liberty City Bot - Member Update Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember) {
        const client = newMember.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleGuildMemberUpdate(oldMember, newMember).catch((err) => client.loggingHandler.reportFailure('guildMemberUpdate', err));
    },
};
exports.default = event;
//# sourceMappingURL=guildMemberUpdate.js.map