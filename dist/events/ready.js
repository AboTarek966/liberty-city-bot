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
        // 💾 بدء النسخ الاحتياطي التلقائي فوراً (تأخير ثانية واحدة فقط — لا نترك السيرفر بلا نسخة)
        const lc = client;
        let index = 0;
        client.guilds.cache.forEach(guild => {
            const delay = 1000 + index * 2000;
            index++;
            setTimeout(() => {
                lc.securityHandler.syncAutoBackup(guild).catch(err => logger.error(`syncAutoBackup failed for ${guild.name}:`, err));
                // 🔍 الفحص الدوري — كشف رومات/رولات الهاكر وإصلاحها كل N ساعات
                lc.securityHandler.syncAutoScan(guild).catch(err => logger.error(`syncAutoScan failed for ${guild.name}:`, err));
            }, delay);
        });
        // 🛡️ تشغيل حمايات الأمان فوراً — أي تأخير = نافذة تخريب مفتوحة
        client.guilds.cache.forEach(guild => {
            // 📌 حماية الهرم اللاصقة: تراقب رول البوت باستمرار
            lc.securityHandler.startStickyRoleWatchdog(guild);
            // 📸 مراقبة الحذف الجماعي للرسائل (Snapshotter)
            lc.securityHandler.startMessageSnapshotter(guild);
            // 🕵️ حارس البوتات الخطرة — أول فحص فوري ثم كل 5 ثوانٍ
            lc.securityHandler.startDangerousBotWatchdog(guild);
            // فحص الهرمية (صامت) — يبدأ بدون تأخير
            void lc.securityHandler
                .ensureHierarchyAlert(guild)
                .catch(err => logger.error(`hierarchy check failed for ${guild.name}:`, err));
        });
        // 📨 تهيئة كاش الدعوات لكل السيرفرات
        let iIndex = 0;
        client.guilds.cache.forEach(guild => {
            const delay = 35000 + iIndex * 5000;
            iIndex++;
            setTimeout(() => {
                lc.inviteTrackerHandler.cacheGuildInvites(guild).catch(err => logger.error(`invite cache failed for ${guild.name}:`, err));
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
        // 🏦 فائدة البنك: تطبيق يومي (كل 24 ساعة)
        setInterval(() => {
            client.guilds.cache.forEach(guild => {
                lc.economyHandler.applyBankInterest(guild).catch(err => logger.error(`Bank interest error for ${guild.name}:`, err));
            });
        }, 24 * 60 * 60 * 1000);
    },
};
exports.default = event;
//# sourceMappingURL=ready.js.map