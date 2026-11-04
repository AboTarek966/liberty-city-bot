"use strict";
// ============================================
// Omni Bot - Role Create Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'roleCreate',
    async execute(role) {
        const client = role.client;
        // 🛡️ Anti-Create: أي بوت ينشئ رول → يُحذف فوراً
        await client.securityHandler.onRoleCreate(role).catch(() => { });
        // 📋 سجل الرول المنشأ
        client.loggingHandler?.handleRoleCreate(role).catch((err) => {
            client.loggingHandler?.reportFailure('roleCreate', err);
        });
    },
};
exports.default = event;
//# sourceMappingURL=roleCreate.js.map