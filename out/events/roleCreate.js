"use strict";
// ============================================
// Liberty City Bot - Role Create Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'roleCreate',
    async execute(role) {
        const client = role.client;
        // 🛡️ Anti-Create: أي بوت ينشئ رول → يُحذف فوراً
        await client.securityHandler.onRoleCreate(role).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=roleCreate.js.map