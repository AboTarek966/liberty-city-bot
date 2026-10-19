// ============================================
// Liberty City Bot - Guild Create
// عند انضمام البوت لسيرفر جديد: تسجيل الأوامر فوراً
// حتى تظهر أوامر السلاش خلال ثوانٍ في السيرفر الجديد
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';

const logger = createLogger('GuildCreate');

const guildCreateEvent: Event = {
  name: 'guildCreate',
  async execute(guild: any) {
    logger.info(`📥 Bot joined guild: ${guild.name} (${guild.id})`);

    const client = guild.client as LibertyClient;

    // 🛡️ تأمين السيرفر الجديد فوراً:
    //    1) فحص التسلّم — البوت لازم أعلى رتبة وإلا كل الحماية معطّلة
    //    2) نسخة احتياطية أولى — تمهيداً للاستعادة التلقائية
    try {
      await client.securityHandler.ensureHierarchyAlert(guild);
      await client.securityHandler.syncAutoBackup(guild, true);
      await client.securityHandler.syncAutoScan(guild);
    } catch (error) {
      logger.warn(`Security setup failed in ${guild.id}:`, error);
    }
  },
};

export default guildCreateEvent;
