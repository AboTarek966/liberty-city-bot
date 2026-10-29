"use strict";
// ============================================
// Liberty City Bot - Sticker Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'stickerDelete',
    async execute(sticker) {
        const client = sticker.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleStickerDelete(sticker).catch((err) => client.loggingHandler.reportFailure('stickerDelete', err));
    },
};
exports.default = event;
//# sourceMappingURL=stickerDelete.js.map