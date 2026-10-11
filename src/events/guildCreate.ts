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
    try {
      await client.registerCommandsForGuild(guild.id);
      logger.info(`✅ Registered commands instantly in new guild ${guild.id}`);
    } catch (error) {
      logger.warn(`Failed to register commands in new guild ${guild.id}:`, error);
    }
  },
};

export default guildCreateEvent;
