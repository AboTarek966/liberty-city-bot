"use strict";
// ============================================
// Liberty City Bot - Emoji Delete Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'emojiDelete',
    async execute(emoji) {
        const client = emoji.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleEmojiDelete(emoji).catch((err) => client.loggingHandler.reportFailure('emojiDelete', err));
    },
};
exports.default = event;
//# sourceMappingURL=emojiDelete.js.map