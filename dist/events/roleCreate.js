"use strict";
// ============================================
// Liberty City Bot - Role Logging Events
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const roleCreateEvent = {
    name: 'roleCreate',
    async execute(role) {
        const client = role.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleRoleCreate(role).catch((err) => client.loggingHandler.reportFailure('roleCreate', err));
    },
};
exports.default = roleCreateEvent;
//# sourceMappingURL=roleCreate.js.map