"use strict";
// ============================================
// Liberty City Bot - Sticker Delete Protection
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'guildStickerDelete',
    async execute(sticker) {
        const client = sticker.client;
        await client.securityHandler.onGuildStickerDelete(sticker).catch(() => { });
    },
};
exports.default = event;
//# sourceMappingURL=guildStickerDelete.js.map