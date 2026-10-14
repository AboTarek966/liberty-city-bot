"use strict";
// ============================================
// Liberty City Bot - Role Update (Logging + Anti-Admin)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'roleUpdate',
    async execute(oldRole, newRole) {
        const client = newRole.client;
        // 📋 سجل تعديل الرولات
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleRoleUpdate(oldRole, newRole).catch((err) => client.loggingHandler.reportFailure('roleUpdate', err));
        // 🛡️ Anti-Admin: تنبيه عند منح صلاحية Administrator
        await client.securityHandler.onRoleUpdate(oldRole, newRole).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=roleUpdate.js.map