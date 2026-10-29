"use strict";
// ============================================
// Liberty City Bot - Unban Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildBanRemove',
    async execute(ban) {
        const client = ban.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleGuildBanRemove(ban).catch((err) => client.loggingHandler.reportFailure('guildBanRemove', err));
    },
};
exports.default = event;
//# sourceMappingURL=guildBanRemove.js.map