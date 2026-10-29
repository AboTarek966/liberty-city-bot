"use strict";
// ============================================
// Liberty City Bot - Invite Logging Events
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const inviteCreateEvent = {
    name: 'inviteCreate',
    async execute(invite) {
        const client = invite.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleInviteCreate(invite).catch((err) => client.loggingHandler.reportFailure('inviteCreate', err));
    },
};
exports.default = inviteCreateEvent;
//# sourceMappingURL=inviteCreate.js.map