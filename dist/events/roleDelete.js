"use strict";
// ============================================
// Liberty City Bot - Role Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'roleDelete',
    async execute(role) {
        const client = role.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleRoleDelete(role).catch((err) => client.loggingHandler.reportFailure('roleDelete', err));
        // 🛡️ Anti-Nuke: رصد الحذف الجماعي للرولات
        await client.securityHandler.onRoleDelete(role).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=roleDelete.js.map