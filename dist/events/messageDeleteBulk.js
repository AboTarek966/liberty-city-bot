"use strict";
// ============================================
// Liberty City Bot - Message Delete Bulk Event
// كشف الحذف الجماعي للرسائل (Anti-Mass-Delete)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('Event:MessageDeleteBulk');
const event = {
    name: 'messageDeleteBulk',
    async execute(messages) {
        const client = messages.first()?.client;
        if (!client?.securityHandler)
            return;
        try {
            await client.securityHandler.onMessageDeleteBulk(messages);
        }
        catch (error) {
            logger.error(`messageDeleteBulk handler error: ${error.message}`);
        }
    },
};
exports.default = event;
//# sourceMappingURL=messageDeleteBulk.js.map