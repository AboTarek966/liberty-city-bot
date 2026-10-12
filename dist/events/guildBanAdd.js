"use strict";
// ============================================
// Liberty City Bot - Ban Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildBanAdd',
    async execute(ban) {
        const client = ban.client;
        await client.loggingHandler.handleGuildBanAdd(ban);
        // 🛡️ Anti-Nuke: رصد الحظر الجماعي
        await client.securityHandler.onBanAdd(ban).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=guildBanAdd.js.map