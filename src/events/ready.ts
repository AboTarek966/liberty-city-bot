// ============================================
// Liberty City Bot - Ready Event
// ============================================

import { Client } from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';

const logger = createLogger('Event:Ready');

const event: Event = {
  name: 'ready',
  once: true,
  execute(client: Client) {
    logger.info(`✅ Logged in as ${client.user?.tag}`);
    logger.info(`🏠 Guilds: ${client.guilds.cache.size}`);
    logger.info(`👥 Users: ${client.users.cache.size}`);
    logger.info(`📡 WebSocket Ping: ${client.ws.ping}ms`);
    
    // Set bot status
    client.user?.setPresence({
      activities: [
        {
          name: '/help | Liberty City',
          type: 0, // Playing
        },
      ],
      status: 'online',
    });

    // 💾 بدء النسخ الاحتياطي التلقائي (مؤجل تدريجياً لتفادي الضغط)
    const lc = client as LibertyClient;
    let index = 0;
    client.guilds.cache.forEach(guild => {
      const delay = 15000 + index * 8000;
      index++;
      setTimeout(() => {
        lc.securityHandler.syncAutoBackup(guild).catch(err =>
          logger.error(`syncAutoBackup failed for ${guild.name}:`, err)
        );
      }, delay);
    });

    // 🛡️ فحص التسلّم عند الإقلاع — ينبّه فوراً لو البوت ليس أعلى رتبة
    //    (بدونه: مضاد النيوك والاستعادة التلقائية تفشل بصمت عند الهجوم)
    let hIndex = 0;
    client.guilds.cache.forEach(guild => {
      const delay = 25000 + hIndex * 8000;
      hIndex++;
      setTimeout(() => {
        lc.securityHandler.ensureHierarchyAlert(guild).catch(err =>
          logger.error(`hierarchy check failed for ${guild.name}:`, err)
        );
        // 📌 حماية الهرم اللاصقة: كل 10 ثواني يتأكد إن رول البوت في القمة
        lc.securityHandler.startStickyRoleWatchdog(guild);
      }, delay);
    });

    // 📈 نظام المستويات: استئناف جلسات الصوت الجارية + احتساب دوري كل 5 دقائق
    client.guilds.cache.forEach(guild => {
      guild.voiceStates.cache.forEach(vs => {
        const member = vs.member;
        if (member && !member.user.bot && vs.channelId) {
          lc.levelingHandler.trackVoiceJoin(guild.id, member.id).catch(() => {});
        }
      });
    });

    setInterval(() => {
      lc.levelingHandler.creditActiveVoiceSessions().catch(err =>
        logger.error('Voice XP credit error:', err)
      );
    }, 5 * 60 * 1000);

    // ⏳ التذاكر الخاملة: فحص دوري كل 15 دقيقة (تحذير ثم إغلاق تلقائي)
    setInterval(() => {
      lc.ticketHandler.sweepInactiveTickets(client).catch(err =>
        logger.error('Ticket inactivity sweep error:', err)
      );
    }, 15 * 60 * 1000);
  },
};

export default event;