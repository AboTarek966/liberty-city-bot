// ============================================
// Liberty City Bot - Guild Delete
// عند خروج البوت من سيرفر: تنظيف كل الموارد المرتبطة به
// (مؤقتات الفحص/النسخ، كاش الدعوات، كاش الإعدادات، الصوت)
// حتى لا يبقى للبوت أي أثر أو معرفة بذلك السيرفر
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';

const logger = createLogger('GuildDelete');

const guildDeleteEvent: Event = {
  name: 'guildDelete',
  async execute(guild: any) {
    logger.info(`📤 Bot left guild: ${guild.name || guild.id} (${guild.id})`);

    const client = (guild.client || undefined) as LibertyClient | undefined;
    if (!client) return;

    try {
      // ⏱️ إيقاف كل المؤقتات (فحص دوري كل 6 ساعات + نسخ احتياطي + snapshotter كل 30 ثانية...)
      client.securityHandler.clearGuild(guild.id);
    } catch (error: any) {
      logger.warn(`Security cleanup failed for ${guild.id}: ${error?.message || error}`);
    }

    try {
      // 📨 كاش دعوات السيرفر
      client.inviteTrackerHandler.clearGuild(guild.id);
    } catch (error: any) {
      logger.warn(`Invite cache cleanup failed for ${guild.id}: ${error?.message || error}`);
    }

    try {
      // 🎵 مغادرة أي قناة صوتية وتفريغ قائمة الموسيقى
      if (client.musicHandler?.isConnected(guild.id)) {
        client.musicHandler.leave(guild.id);
      }
    } catch (error: any) {
      logger.warn(`Music cleanup failed for ${guild.id}: ${error?.message || error}`);
    }

    // ⚙️ كاش إعدادات السيرفر — حذف نهائي
    client.guildSettingsCache?.delete(guild.id);
  },
};

export default guildDeleteEvent;
