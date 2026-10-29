"use strict";
// ============================================
// Liberty City Bot - Guild Delete
// عند خروج البوت من سيرفر: تنظيف كل الموارد المرتبطة به
// (مؤقتات الفحص/النسخ، كاش الدعوات، كاش الإعدادات، الصوت)
// حتى لا يبقى للبوت أي أثر أو معرفة بذلك السيرفر
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('GuildDelete');
const guildDeleteEvent = {
    name: 'guildDelete',
    async execute(guild) {
        logger.info(`📤 Bot left guild: ${guild.name || guild.id} (${guild.id})`);
        const client = (guild.client || undefined);
        if (!client)
            return;
        try {
            // ⏱️ إيقاف كل المؤقتات (فحص دوري كل 6 ساعات + نسخ احتياطي + snapshotter كل 30 ثانية...)
            client.securityHandler.clearGuild(guild.id);
        }
        catch (error) {
            logger.warn(`Security cleanup failed for ${guild.id}: ${error?.message || error}`);
        }
        try {
            // 📨 كاش دعوات السيرفر
            client.inviteTrackerHandler.clearGuild(guild.id);
        }
        catch (error) {
            logger.warn(`Invite cache cleanup failed for ${guild.id}: ${error?.message || error}`);
        }
        try {
            // 🎵 مغادرة أي قناة صوتية وتفريغ قائمة الموسيقى
            if (client.musicHandler?.isConnected(guild.id)) {
                client.musicHandler.leave(guild.id);
            }
        }
        catch (error) {
            logger.warn(`Music cleanup failed for ${guild.id}: ${error?.message || error}`);
        }
        // ⚙️ كاش إعدادات السيرفر — حذف نهائي
        client.guildSettingsCache?.delete(guild.id);
    },
};
exports.default = guildDeleteEvent;
//# sourceMappingURL=guildDelete.js.map