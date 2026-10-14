"use strict";
// ============================================
// Liberty City Bot - Invite Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'inviteDelete',
    async execute(invite) {
        const client = invite.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleInviteDelete(invite).catch((err) => client.loggingHandler.reportFailure('inviteDelete', err));
    },
};
exports.default = event;
//# sourceMappingURL=inviteDelete.js.map