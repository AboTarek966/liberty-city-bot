"use strict";
// ============================================
// Liberty City Bot - Logging Events (All-in-one)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const snipeCache_1 = require("../utils/snipeCache");
// Message Delete
const messageDeleteEvent = {
    name: 'messageDelete',
    async execute(message) {
        const client = message.client;
        // 🕵️ حفظ نسخة من الرسالة محذوفة (سنايب) قبل معالجة السجلات
        (0, snipeCache_1.recordDeletedMessage)(message);
        await client.loggingHandler.handleMessageDelete(message);
    },
};
exports.default = messageDeleteEvent;
//# sourceMappingURL=messageDelete.js.map