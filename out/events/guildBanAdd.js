"use strict";
// ============================================
// Liberty City Bot - Ban Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildBanAdd',
    async execute(ban) {
        const client = ban.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleGuildBanAdd(ban).catch((err) => client.loggingHandler.reportFailure('guildBanAdd', err));
        // 🛡️ Anti-Nuke: رصد الحظر الجماعي
        await client.securityHandler.onBanAdd(ban).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=guildBanAdd.js.map