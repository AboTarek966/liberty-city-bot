"use strict";
// ============================================
// Liberty City Bot - Sticker Create Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'stickerCreate',
    async execute(sticker) {
        const client = sticker.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleStickerCreate(sticker).catch((err) => client.loggingHandler.reportFailure('stickerCreate', err));
    },
};
exports.default = event;
//# sourceMappingURL=stickerCreate.js.map