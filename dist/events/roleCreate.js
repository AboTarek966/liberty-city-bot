"use strict";
// ============================================
// Liberty City Bot - Role Logging Events
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const roleCreateEvent = {
    name: 'roleCreate',
    async execute(role) {
        const client = role.client;
        await client.loggingHandler.handleRoleCreate(role);
    },
};
exports.default = roleCreateEvent;
//# sourceMappingURL=roleCreate.js.map