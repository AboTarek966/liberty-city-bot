"use strict";
// ============================================
// Liberty City Bot - Unban Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildBanRemove',
    async execute(ban) {
        const client = ban.client;
        await client.loggingHandler.handleGuildBanRemove(ban);
    },
};
exports.default = event;
//# sourceMappingURL=guildBanRemove.js.map