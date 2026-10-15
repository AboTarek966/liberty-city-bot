"use strict";
// ============================================
// Liberty City Bot - Emoji Delete Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildEmojiDelete',
    async execute(emoji) {
        const client = emoji.client;
        await client.securityHandler.onGuildEmojiDelete(emoji).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=guildEmojiDelete.js.map