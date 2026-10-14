"use strict";
// ============================================
// Liberty City Bot - Emoji Create Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'emojiCreate',
    async execute(emoji) {
        const client = emoji.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleEmojiCreate(emoji).catch((err) => client.loggingHandler.reportFailure('emojiCreate', err));
    },
};
exports.default = event;
//# sourceMappingURL=emojiCreate.js.map