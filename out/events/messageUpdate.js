"use strict";
// ============================================
// Omni Bot - Message Edit Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const botAbuse_1 = require("../utils/botAbuse");
const event = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage) {
        const client = newMessage.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleMessageEdit(oldMessage, newMessage).catch((err) => client.loggingHandler.reportFailure('messageUpdate', err));
        // 🤖 لو عدّل الرسالة إلى سب للبوت بعد إرسالها — نطبّق نفس الحماية
        if (newMessage.guild &&
            !newMessage.author?.bot &&
            typeof newMessage.content === 'string' &&
            newMessage.content &&
            typeof oldMessage.content === 'string' &&
            newMessage.content !== oldMessage.content) {
            (0, botAbuse_1.handleBotAbuse)(newMessage).catch((error) => {
                client.loggingHandler.reportFailure('messageUpdate:antiBotAbuse', error);
            });
        }
    },
};
exports.default = event;
//# sourceMappingURL=messageUpdate.js.map