"use strict";
// ============================================
// Liberty City Bot - Guild Create
// عند انضمام البوت لسيرفر جديد: تسجيل الأوامر فوراً
// حتى تظهر أوامر السلاش خلال ثوانٍ في السيرفر الجديد
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('GuildCreate');
const guildCreateEvent = {
    name: 'guildCreate',
    async execute(guild) {
        logger.info(`📥 Bot joined guild: ${guild.name} (${guild.id})`);
        const client = guild.client;
        // 🛡️ تأمين السيرفر الجديد فوراً:
        //    1) فحص التسلّم — البوت لازم أعلى رتبة وإلا كل الحماية معطّلة
        //    2) نسخة احتياطية أولى — تمهيداً للاستعادة التلقائية
        try {
            await client.securityHandler.ensureHierarchyAlert(guild);
            await client.securityHandler.syncAutoBackup(guild, true);
            await client.securityHandler.syncAutoScan(guild);
        }
        catch (error) {
            logger.warn(`Security setup failed in ${guild.id}:`, error);
        }
    },
};
exports.default = guildCreateEvent;
//# sourceMappingURL=guildCreate.js.map