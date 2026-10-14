"use strict";
// ============================================
// Liberty City Bot - Ready Event
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('Event:Ready');
const event = {
    name: 'ready',
    once: true,
    execute(client) {
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
        const lc = client;
        let index = 0;
        client.guilds.cache.forEach(guild => {
            const delay = 15000 + index * 8000;
            index++;
            setTimeout(() => {
                lc.securityHandler.syncAutoBackup(guild).catch(err => logger.error(`syncAutoBackup failed for ${guild.name}:`, err));
            }, delay);
        });
        // 🛡️ فحص التسلّم عند الإقلاع — ينبّه فوراً لو البوت ليس أعلى رتبة
        //    (بدونه: مضاد النيوك والاستعادة التلقائية تفشل بصمت عند الهجوم)
        let hIndex = 0;
        client.guilds.cache.forEach(guild => {
            const delay = 25000 + hIndex * 8000;
            hIndex++;
            setTimeout(() => {
                lc.securityHandler.ensureHierarchyAlert(guild).catch(err => logger.error(`hierarchy check failed for ${guild.name}:`, err));
            }, delay);
        });
        // 📈 نظام المستويات: استئناف جلسات الصوت الجارية + احتساب دوري كل 5 دقائق
        client.guilds.cache.forEach(guild => {
            guild.voiceStates.cache.forEach(vs => {
                const member = vs.member;
                if (member && !member.user.bot && vs.channelId) {
                    lc.levelingHandler.trackVoiceJoin(guild.id, member.id).catch(() => { });
                }
            });
        });
        setInterval(() => {
            lc.levelingHandler.creditActiveVoiceSessions().catch(err => logger.error('Voice XP credit error:', err));
        }, 5 * 60 * 1000);
        // ⏳ التذاكر الخاملة: فحص دوري كل 15 دقيقة (تحذير ثم إغلاق تلقائي)
        setInterval(() => {
            lc.ticketHandler.sweepInactiveTickets(client).catch(err => logger.error('Ticket inactivity sweep error:', err));
        }, 15 * 60 * 1000);
    },
};
exports.default = event;
//# sourceMappingURL=ready.js.map