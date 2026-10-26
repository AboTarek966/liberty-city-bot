"use strict";
// ============================================
// Liberty City Bot - Security Handler (Anti-Nuke Suite)
// حزمة الحماية الشاملة ضد اختراق السيرفر:
//  1) Anti-Nuke   : كشف الحذف الجماعي (قنوات/رولات/باند) + معاقبة المخالف
//  2) Anti-Bot    : طرد البوتات غير المصرح بها
//  3) Anti-Admin  : تنبيه/عقوبة عند منح صلاحية Administrator
//  4) Auto-Backup : نسخ احتياطي دوري لبنية السيرفر + الاستعادة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityHandler = void 0;
exports.computeHierarchy = computeHierarchy;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const models_1 = require("../models");
const embeds_1 = require("../utils/embeds");
const logger = (0, helpers_1.createLogger)('SecurityHandler');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// أنواع القنوات القابلة لإعادة الإنشاء
const RESTORABLE_CHANNEL_TYPES = [
    discord_js_1.ChannelType.GuildText,
    discord_js_1.ChannelType.GuildVoice,
    discord_js_1.ChannelType.GuildAnnouncement,
    discord_js_1.ChannelType.GuildStageVoice,
    discord_js_1.ChannelType.GuildForum,
    discord_js_1.ChannelType.GuildCategory,
    discord_js_1.ChannelType.GuildMedia,
];
/**
 * 🛡️ فحص تسلّم البوت — أهم مؤشر أمني في السيرفر
 *
 * Discord يمنع المساس بأحد أعلى منك في الرتب مهما كانت صلاحياتك،
 * فلو رول المهاجم فوق رول البوت: `ban`/`kick`/سحب الرولات **تفشل كلها بصمت**.
 * هذا الفحص هو ما يميّز حماية حقيقية عن حماية ورقية.
 *
 * دالة مستقلة (لا تعتمد على `this`) لتُختبر وتُستخدم من لوحة الإعدادات.
 */
function computeHierarchy(guild) {
    const me = guild.members.me;
    if (!me) {
        return { ok: false, botRoleName: '—', botPosition: -1, offenders: [], offenderCount: 0, dangerous: false };
    }
    const botTop = me.roles.highest;
    const botPosition = botTop.position;
    const DANGEROUS = [
        discord_js_1.PermissionFlagsBits.Administrator,
        discord_js_1.PermissionFlagsBits.ManageGuild,
        discord_js_1.PermissionFlagsBits.ManageRoles,
        discord_js_1.PermissionFlagsBits.ManageChannels,
        discord_js_1.PermissionFlagsBits.BanMembers,
        discord_js_1.PermissionFlagsBits.KickMembers,
        discord_js_1.PermissionFlagsBits.ModerateMembers,
    ];
    const above = guild.roles.cache.filter(r => r.id !== guild.id && // ليس @everyone
        !r.managed && // رولات التكاملات تُستثنى
        r.id !== botTop.id &&
        r.position > botPosition);
    const offenders = above
        .sort((a, b) => b.position - a.position)
        .map(r => `${r.name} (\`#${r.position}\`)`)
        .slice(0, 15);
    const dangerous = above.some(r => DANGEROUS.some(p => r.permissions.has(p)));
    return {
        ok: above.size === 0,
        botRoleName: botTop.name,
        botPosition,
        offenders,
        offenderCount: above.size,
        dangerous,
    };
}
class SecurityHandler {
    client;
    // تتبّع عمليات الحذف: guildId → { نوع → توقيتات }
    deletionTracker = new Map();
    // 🔥 تتبّع حذف الرسائل الجماعي: guildId → channelId → timestamps
    messageDeletionTracker = new Map();
    // 📸 لقطات رسائل للاستعادة الفورية: guildId → channelId → MessageSnapshot
    messageSnapshots = new Map();
    // تتبّع تغيير الأسماء السريع: key → توقيتات
    renameTracker = new Map();
    // مؤقتات النسخ الاحتياطي التلقائي
    backupTimers = new Map();
    // 🔍 مؤقتات الفحص الدوري (كشف هاكر كل N ساعات)
    scanTimers = new Map();
    // آخر حالة تسلّم مُبلَّغ عنها لكل سيرفر (ننبّه فقط عند تغيّر الحالة)
    hierarchyState = new Map();
    // مؤقتات الاستعادة التلقائية المؤجلة (تُجمَّع عدة حذفات في استعادة واحدة)
    restoreTimers = new Map();
    // 🔒 مقفل استعادة لكل سيرفر — يمنع إنشاء قنوات مكرّرة عند التزامن
    restoreLocks = new Map();
    // 👢 المطرودون بانتظار إرسال رابط الدعوة (استعادة تلقائية)
    //    الطرد لا يُلغى في ديسكورد — الطريقة الوحيدة لإرجاعهم هي الرابط
    kickedQueue = new Map();
    kickedTimers = new Map();
    // Pro Max: sticky role watchdog timers
    topWatchdogs = new Map();
    // 💣 Nuke detection tracker
    nukeTracker = new Map();
    // ⚡ بثّ سجلات التدقيق الفوري من Gateway — يحدّد المنفّذ بدون أي طلب REST
    //    (أسرع طريق ممكن: السجل يصل مع الحدث نفسه تقريباً)
    auditStream = new Map();
    // 🎯 آثار المهاجم: قنوات/رولات/ويب هوكس أنشأها → تُحذف كلها بعد الحادث
    attackerArtifacts = new Map();
    // 🚨 حادث نشط: يظل يمنع أي إنشاء جديد من المهاجم لمدة دقيقتين
    activeIncidents = new Map();
    // 📈 معدل رسائل الويب هوك/البوتات (key → timestamps)
    messageRate = new Map();
    // 📈 معدل إنشاء القنوات/الرولات لكل منفّذ (key → timestamps)
    createTracker = new Map();
    // 📈 معدل الحظر/الطرد لكل منفّذ — لا نخلط بين مشرفين مختلفين
    actionTracker = new Map();
    // 🧹 منع تكرار معالجة نفس الهدف/المنفّذ خلال ثوانٍ
    handledTargets = new Map();
    // 🤖 حارس البوتات الخطرة (يفحص البوتات الموجودة كل 30 ثانية)
    botGuardTimers = new Map();
    // ⏳ تهدئة حارس البوتات: البوت الذي فشل تحييده لا يُعاد فحصه إلا بعد 10 دقائق
    botGuardBackoff = new Map();
    // ⚡ منع تكرار عقوبة نفس الحساب خلال دقيقة (تفادي أخطاء "محظور مسبقاً" وتوفير REST)
    recentBans = new Map();
    recentKicks = new Map();
    constructor(client) {
        this.client = client;
        // تنظيف دوري كل 5 دقائق لمنع تسرب الذاكرة
        setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
    }
    // --------------------------------------------
    // تنظيف كل موارد السيرفر — يُستدعى عند مغادرة البوت (guildDelete)
    // حتى لا تبقى مؤقتات/كاش/بيانات تخص سيرفر البوت خرج منه
    // --------------------------------------------
    clearGuild(guildId) {
        const clearOne = (m) => {
            const t = m.get(guildId);
            if (t) {
                clearInterval(t);
                clearTimeout(t);
                m.delete(guildId);
            }
        };
        clearOne(this.backupTimers);
        clearOne(this.scanTimers);
        clearOne(this.restoreTimers);
        clearOne(this.kickedTimers);
        clearOne(this.topWatchdogs);
        clearOne(this.messageSnapshotInterval);
        this.deletionTracker.delete(guildId);
        this.messageDeletionTracker.delete(guildId);
        this.messageSnapshots.delete(guildId);
        this.renameTracker.delete(guildId);
        this.hierarchyState.delete(guildId);
        this.restoreLocks.delete(guildId);
        this.kickedQueue.delete(guildId);
        this.nukeTracker.delete(guildId);
        this.auditStream.delete(guildId);
        for (const key of this.attackerArtifacts.keys())
            if (key.startsWith(`${guildId}:`))
                this.attackerArtifacts.delete(key);
        this.activeIncidents.delete(guildId);
        this.hierarchyState.delete(guildId);
        const guard = this.botGuardTimers.get(guildId);
        if (guard) {
            clearInterval(guard);
            this.botGuardTimers.delete(guildId);
        }
        // معدلات الرسائل/الإنشاء الخاصة بالسيرفر
        for (const key of this.messageRate.keys())
            if (key.startsWith(`${guildId}:`))
                this.messageRate.delete(key);
        for (const key of this.createTracker.keys())
            if (key.startsWith(`${guildId}:`))
                this.createTracker.delete(key);
        for (const key of this.handledTargets.keys())
            if (key.startsWith(`${guildId}:`))
                this.handledTargets.delete(key);
        for (const key of this.recentBans.keys())
            if (key.startsWith(`${guildId}:`))
                this.recentBans.delete(key);
        for (const key of this.recentKicks.keys())
            if (key.startsWith(`${guildId}:`))
                this.recentKicks.delete(key);
        for (const key of this.botGuardBackoff.keys())
            if (key.startsWith(`${guildId}:`))
                this.botGuardBackoff.delete(key);
        logger.info(`🧹 Cleared all per-guild resources for ${guildId}`);
    }
    cleanup() {
        for (const timer of this.backupTimers.values())
            clearInterval(timer);
        this.backupTimers.clear();
        for (const timer of this.scanTimers.values())
            clearInterval(timer);
        this.scanTimers.clear();
        for (const timer of this.restoreTimers.values())
            clearTimeout(timer);
        this.restoreTimers.clear();
        this.restoreLocks.clear();
        for (const timer of this.kickedTimers.values())
            clearTimeout(timer);
        this.kickedTimers.clear();
        this.kickedQueue.clear();
        // Cleanup message snapshots (older than 1 hour)
        for (const [guildId, channels] of this.messageSnapshots) {
            for (const [channelId, snapshot] of channels) {
                if (Date.now() - snapshot.at > 3600000) {
                    channels.delete(channelId);
                }
            }
            if (channels.size === 0)
                this.messageSnapshots.delete(guildId);
        }
        // Cleanup message deletion trackers
        for (const [guildId, tracker] of this.messageDeletionTracker) {
            const now = Date.now();
            for (const channelId of Object.keys(tracker)) {
                tracker[channelId] = tracker[channelId].filter(t => now - t <= 60000);
                if (tracker[channelId].length === 0)
                    delete tracker[channelId];
            }
            if (Object.keys(tracker).length === 0)
                this.messageDeletionTracker.delete(guildId);
        }
        // Cleanup nuke tracker (older than 1 minute)
        const now = Date.now();
        for (const [guildId, tracker] of this.nukeTracker) {
            if (now - tracker.lastAction > 60000) {
                this.nukeTracker.delete(guildId);
            }
        }
        // Cleanup audit log cache (older than 10 seconds)
        for (const [key, val] of this.auditLogCache) {
            if (now - val.at > 10000)
                this.auditLogCache.delete(key);
        }
        // Cleanup rate trackers / incidents / artifacts / handled targets
        for (const [key, arr] of this.messageRate) {
            const fresh = arr.filter(t => now - t <= 15000);
            if (fresh.length)
                this.messageRate.set(key, fresh);
            else
                this.messageRate.delete(key);
        }
        for (const [key, arr] of this.createTracker) {
            const fresh = arr.filter(t => now - t <= 15000);
            if (fresh.length)
                this.createTracker.set(key, fresh);
            else
                this.createTracker.delete(key);
        }
        for (const [key, arr] of this.actionTracker) {
            const fresh = arr.filter(t => now - t <= 60000);
            if (fresh.length)
                this.actionTracker.set(key, fresh);
            else
                this.actionTracker.delete(key);
        }
        for (const [key, at] of this.handledTargets) {
            if (now - at > 30000)
                this.handledTargets.delete(key);
        }
        for (const [key, at] of this.recentBans) {
            if (now - at > 60000)
                this.recentBans.delete(key);
        }
        for (const [key, at] of this.recentKicks) {
            if (now - at > 60000)
                this.recentKicks.delete(key);
        }
        for (const [key, at] of this.botGuardBackoff) {
            if (now >= at)
                this.botGuardBackoff.delete(key);
        }
        for (const [guildId, inc] of this.activeIncidents) {
            if (now > inc.expires)
                this.activeIncidents.delete(guildId);
        }
        for (const [guildId, art] of this.attackerArtifacts) {
            if (now - art.at > 30 * 60 * 1000)
                this.attackerArtifacts.delete(guildId);
        }
        for (const [guildId, arr] of this.auditStream) {
            const fresh = arr.filter(e => now - (e.createdTimestamp ?? 0) < 20000);
            if (fresh.length)
                this.auditStream.set(guildId, fresh);
            else
                this.auditStream.delete(guildId);
        }
    }
    // --------------------------------------------
    // Helpers
    // --------------------------------------------
    // قناة تنبيهات الأمن: مخصصة → حماية عامة → أنتينوك → سجلات → نظام → أول قناة قابلة للإرسال
    async getAlertChannel(guild, settings, specific) {
        const candidates = [
            specific,
            settings?.protection?.logChannel,
            settings?.protection?.antiNuke?.logChannel,
            settings?.logging?.channelId,
        ];
        for (const id of candidates) {
            if (!id)
                continue;
            const channel = guild.channels.cache.get(id);
            if (channel && channel.isTextBased() && 'send' in channel) {
                return channel;
            }
        }
        if (guild.systemChannel)
            return guild.systemChannel;
        const me = guild.members.me;
        if (!me)
            return null;
        return (guild.channels.cache.find(c => {
            if (c.type !== discord_js_1.ChannelType.GuildText)
                return false;
            const perms = c.permissionsFor(me);
            return !!perms?.has(discord_js_1.PermissionFlagsBits.SendMessages) && !!perms?.has(discord_js_1.PermissionFlagsBits.EmbedLinks);
        }) || null);
    }
    // ⚡ كاش سجلات التدقيق — 2 ثوانٍ TTL (احتياطي فقط، البثّ الفوري يسبقه)
    auditLogCache = new Map();
    // ثابت: بوتات ديسكورد الرسمية المسموح بها دائماً
    static TRUSTED_BOT_IDS = [
        '854233015475109888', // Clyde (Discord)
        '293036868578279425', // Discord Bots
    ];
    /** يستقبل سجل التدقيق لحظة وصوله من Gateway (بدون REST) */
    ingestAuditEntry(entry, guildId) {
        try {
            const gid = guildId || entry?.guild?.id || entry?.guildId;
            if (!gid || entry?.action === undefined)
                return;
            const arr = this.auditStream.get(gid) || [];
            arr.unshift(entry);
            const cutoff = Date.now() - 20000;
            while (arr.length > 250 || (arr.length > 0 && (arr[arr.length - 1]?.createdTimestamp ?? 0) < cutoff)) {
                arr.pop();
            }
            this.auditStream.set(gid, arr);
        }
        catch {
            /* لا تعطّل الأمان */
        }
    }
    async getCachedAuditLogs(guild, type, limit = 5) {
        const key = `${guild.id}:${type}`;
        const hit = this.auditLogCache.get(key);
        if (hit && Date.now() - hit.at < 2000)
            return hit.entries;
        const logs = await guild.fetchAuditLogs({ type, limit });
        const entries = [...logs.entries];
        this.auditLogCache.set(key, { at: Date.now(), entries });
        return entries;
    }
    // يبحث عن سجل تدقيق محدد في البثّ الفوري فقط (بدون REST)
    findStreamedEntry(guildId, type, targetId, maxAgeMs = 20000) {
        const now = Date.now();
        const streamed = (this.auditStream.get(guildId) || []).filter(e => e.action === type && now - (e.createdTimestamp ?? now) < maxAgeMs);
        const matches = targetId
            ? streamed.filter(e => e.targetId === targetId)
            : streamed;
        if (!matches.length)
            return undefined;
        // ⚡ نفضّل سجل المهاجم على سجل البوت نفسه (البوت قد يكون أعاد الاسم/القناة للتو)
        const nonSelf = matches.filter(e => e.executor?.id && e.executor.id !== this.client.user?.id);
        return nonSelf[0] ?? matches[0];
    }
    /**
     * ⚡ انتظار سجل التدقيق من Gateway (حتى 1.5 ثانية) ثم REST كاحتياطي.
     * Discord يرسل سجل التدقيق بعد الحدث أحياناً بمئات الأجزاء من الثانية،
     * وكان الكود القديم يستسلم فوراً → تفوت العقوبة. هذا الانتظار القصير يحل المشكلة.
     */
    async findAuditEntry(guild, type, targetId, waitMs = 1500, maxAgeMs = 30000) {
        const deadline = Date.now() + waitMs;
        while (true) {
            const streamed = this.findStreamedEntry(guild.id, type, targetId, maxAgeMs);
            if (streamed)
                return streamed;
            if (Date.now() >= deadline)
                break;
            await sleep(50);
        }
        try {
            const entries = await this.getCachedAuditLogs(guild, type, 20);
            const recent = entries.filter(e => Date.now() - (e.createdTimestamp ?? Date.now()) < maxAgeMs);
            const matches = targetId ? recent.filter(e => e.targetId === targetId) : recent;
            if (!matches.length)
                return null;
            const nonSelf = matches.filter(e => e.executor?.id && e.executor.id !== this.client.user?.id);
            return nonSelf[0] ?? matches[0];
        }
        catch (error) {
            logger.warn(`fetchAuditLogs failed in ${guild.name}: ${error.message}`);
            return null;
        }
    }
    // تحديد المنفّذ — أولاً من بثّ Gateway (فوري)، ثم REST كاحتياطي
    async findExecutor(guild, type, targetId, waitMs = 1500, maxAgeMs = 30000) {
        const entry = await this.findAuditEntry(guild, type, targetId, waitMs, maxAgeMs);
        return entry?.executor ? entry.executor : null;
    }
    // يبحث في سجلات التدقيق عن أمر طرد يستهدف هذا العضو — بثّ فوري + 3 محاولات سريعة
    async findKickExecutor(guild, targetId) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.MemberKick, targetId, attempt === 0 ? 400 : 250);
            if (executor)
                return executor;
            if (attempt < 2)
                await sleep(150);
        }
        return null;
    }
    // يبحث في سجلات التدقيق عن منفّذ أنشأ هدفاً محدداً — بدون شرط الحداثة (للويب هوك)
    async findAuditCreator(guild, type, targetId) {
        const deadline = Date.now() + 1200;
        while (true) {
            const streamed = this.findStreamedEntry(guild.id, type, targetId, 24 * 60 * 60 * 1000);
            if (streamed?.executor)
                return streamed.executor;
            if (Date.now() >= deadline)
                break;
            await sleep(50);
        }
        try {
            const logs = await guild.fetchAuditLogs({ type, limit: 100 });
            const matches = [...logs.entries.values()].filter((e) => e.targetId === targetId &&
                Date.now() - (e.createdTimestamp ?? Date.now()) < 24 * 60 * 60 * 1000 &&
                e.executor);
            const nonSelf = matches.filter((e) => e.executor.id !== this.client.user?.id);
            const found = nonSelf[0] ?? matches[0];
            return found ? found.executor : null;
        }
        catch {
            return null;
        }
    }
    // --------------------------------------------
    // 🎯 أدوات الاستجابة الفورية
    // --------------------------------------------
    recordArtifact(guildId, userId, kind, id) {
        const key = `${guildId}:${userId}`;
        const cur = this.attackerArtifacts.get(key) || {
            channels: new Set(),
            roles: new Set(),
            webhooks: new Set(),
            at: Date.now(),
        };
        cur.at = Date.now();
        cur[kind].add(id);
        this.attackerArtifacts.set(key, cur);
    }
    startIncident(guildId, attackerId) {
        this.activeIncidents.set(guildId, { attackerId, expires: Date.now() + 2 * 60 * 1000 });
    }
    isActiveAttacker(guildId, userId) {
        const inc = this.activeIncidents.get(guildId);
        return !!inc && Date.now() < inc.expires && inc.attackerId === userId;
    }
    markHandled(key) {
        const now = Date.now();
        if (now - (this.handledTargets.get(key) || 0) < 5000)
            return true;
        this.handledTargets.set(key, now);
        return false;
    }
    botWhitelist(_settings) {
        const wl = new Set();
        if (this.client.user?.id)
            wl.add(this.client.user.id);
        for (const id of SecurityHandler.TRUSTED_BOT_IDS)
            wl.add(id);
        // 🚫 الوايت ليست لم تعد استثناءً — كل بوت غير البوت نفسه يُعامل بالتساوي
        return wl;
    }
    // ⚡ حظر/طرد بالمعرّف مباشرة — لا ننتظر جلب العضو (جلب الأعضاء هو أبطأ خطوة)
    async banUserById(guild, userId, reason) {
        if (!userId || userId === guild.ownerId || userId === this.client.user?.id)
            return false;
        const banKey = `${guild.id}:${userId}`;
        const lastBan = this.recentBans.get(banKey);
        if (lastBan && Date.now() - lastBan < 60000)
            return true; // محظور بالفعل الآن
        try {
            await guild.bans.create(userId, { reason });
            this.recentBans.set(banKey, Date.now());
            return true;
        }
        catch (error) {
            // احتياطي: طرد بالمعرّف
            try {
                await guild.members.kick(userId, reason);
                this.recentKicks.set(banKey, Date.now());
                return true;
            }
            catch (kickError) {
                logger.warn(`ban/kick by id failed in ${guild.name} (${userId}): ${error.message} / ${kickError.message}`);
                return false;
            }
        }
    }
    // عقوبة سريعة بالمعرّف (ban/kick) أو سحب رولات (strip)
    async punishById(guild, executor, action, reason) {
        if (executor.id === guild.ownerId)
            return '⏭️ المالك مستثنى';
        if (executor.id === this.client.user?.id)
            return '⏭️ البوت مستثنى';
        const devId = process.env.DEVELOPER_USER_ID;
        if (devId && executor.id === devId)
            return '⏭️ مطوّر البوت مستثنى';
        if (action === 'alert')
            return '🔔 تنبيه فقط';
        if (action === 'ban') {
            const ok = await this.banUserById(guild, executor.id, reason);
            return ok ? '🔨 تم حظر المخالف فوراً' : '⚠️ تعذّر تنفيذ الحظر';
        }
        if (action === 'kick') {
            const kickKey = `${guild.id}:${executor.id}`;
            const lastKick = this.recentKicks.get(kickKey);
            if (lastKick && Date.now() - lastKick < 60000)
                return '👢 تم طرد المخالف فوراً';
            try {
                await guild.members.kick(executor.id, reason);
                this.recentKicks.set(kickKey, Date.now());
                return '👢 تم طرد المخالف فوراً';
            }
            catch (error) {
                return '⚠️ تعذّر تنفيذ الطرد';
            }
        }
        // strip
        const member = guild.members.cache.get(executor.id) ||
            (await guild.members.fetch(executor.id).catch(() => null));
        if (!member)
            return '⚠️ المخالف لم يعد عضواً';
        try {
            await member.roles.set([], reason);
            return '🗡️ تم سلب كل الرولات فوراً';
        }
        catch (error) {
            return `⚠️ فشل سحب الرولات (${error.message})`;
        }
    }
    /** سحب كل رولات حساب بالمعرّف — يعمل حتى لو لم يكن العضو في الكاش */
    async stripRolesById(guild, userId, reason) {
        if (!userId || userId === guild.ownerId || userId === this.client.user?.id)
            return false;
        const member = guild.members.cache.get(userId) ||
            (await guild.members.fetch(userId).catch(() => null));
        if (!member)
            return false;
        try {
            await member.roles.set([], reason);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 🛡️ تحييد فوري: حظر بالمعرّف، ولو فشل (هرمية/صلاحيات) يسحب كل رولاته،
     *    ولو فشل الاثنان يرجع نتيجة صريحة بدل السكوت.
     */
    async neutralizeById(guild, executor, cfg, reason, forceBan = false) {
        this.startIncident(guild.id, executor.id);
        const action = forceBan || cfg?.mode !== 'react' ? 'ban' : (cfg?.action ?? 'ban');
        if (action === 'alert')
            return '🔔 تنبيه فقط';
        if (action === 'strip') {
            return (await this.stripRolesById(guild, executor.id, reason))
                ? '🗡️ سُحبت كل رولاته — لا يستطيع فعل أي شيء'
                : '⚠️ تعذّر سحب الرولات';
        }
        if (action === 'kick') {
            return this.punishById(guild, executor, 'kick', reason);
        }
        // ban: أسرع مسار — بالمعرّف مباشرة
        if (await this.banUserById(guild, executor.id, reason)) {
            return '🔨 حظر فوري ✅';
        }
        // احتياطي: سحب الرولات حتى لو تعذّر الحظر بسبب الهرمية
        if (await this.stripRolesById(guild, executor.id, reason)) {
            return '🗡️ سُحبت كل رولاته (تعذّر الحظر — غالباً بسبب الهرمية)';
        }
        return '⚠️ تعذّر الحظر وسحب الرولات — راجع رتبة البوت';
    }
    /** ردّ فوري على أي اعتداء من إنسان أو بوت (يُستدعى من بثّ سجلات التدقيق) */
    async handleInstantViolation(guild, executor, settings, cfg, label, opts = {}) {
        const reason = `Liberty City — ${label} (Anti-Nuke — ردّ فوري)`;
        const text = await this.neutralizeById(guild, executor, cfg, reason, opts.forceBan ?? false);
        // احذف الهدف الذي أنشأه للتو (قناة/رول)
        if (opts.targetId && opts.deleteTargetKind) {
            if (opts.deleteTargetKind === 'channel') {
                this.recordArtifact(guild.id, executor.id, 'channels', opts.targetId);
                guild.channels.cache
                    .get(opts.targetId)
                    ?.delete('Liberty City — أداة تخريب: هدف أُنشئ أثناء الهجوم')
                    .catch(() => { });
            }
            else {
                this.recordArtifact(guild.id, executor.id, 'roles', opts.targetId);
                const role = guild.roles.cache.get(opts.targetId);
                if (role && role.id !== guild.id && !role.managed) {
                    role.delete('Liberty City — أداة تخريب: دور أُنشئ أثناء الهجوم').catch(() => { });
                }
            }
        }
        void this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
        // تنبيه واحد فقط لكل مهاجم خلال 15 ثانية — حتى لا يغرق السيرفر
        const alertKey = `${guild.id}:violation-alert:${executor.id}`;
        if (!this.markHandled(alertKey)) {
            const ch = await this.getAlertChannel(guild, settings, cfg?.logChannel);
            ch?.send({
                content: `🚨 **حماية فورية — ${label}**\n` +
                    `👤 المنفّذ: ${executor} (\`${this.userLabel(executor)}\`)\n` +
                    `${text}`,
            }).catch(() => { });
        }
        logger.warn(`🚨 Instant guard: ${label} in ${guild.name} | executor=${this.userLabel(executor)} | ${text}`);
    }
    /** عدّاد تغيير أسماء القنوات السريع */
    trackRename(guildId, userId, windowMs) {
        const key = `${guildId}:${userId}`;
        const now = Date.now();
        const arr = (this.renameTracker.get(key) || []).filter(t => now - t <= windowMs);
        arr.push(now);
        this.renameTracker.set(key, arr);
        return arr.length;
    }
    /** هل يملك هذا العضو صلاحيات تخريبية فعلية؟ */
    hasDangerousPermissions(member) {
        const p = member.permissions;
        return (p.has(discord_js_1.PermissionFlagsBits.Administrator) ||
            p.has(discord_js_1.PermissionFlagsBits.ManageGuild) ||
            p.has(discord_js_1.PermissionFlagsBits.ManageChannels) ||
            p.has(discord_js_1.PermissionFlagsBits.ManageRoles) ||
            p.has(discord_js_1.PermissionFlagsBits.ManageWebhooks) ||
            p.has(discord_js_1.PermissionFlagsBits.BanMembers) ||
            p.has(discord_js_1.PermissionFlagsBits.KickMembers));
    }
    /**
     * 🧹 حذف كل ما أنشأه المهاجم (قنوات/رولات/ويب هوكس).
     * يعمل من الذاكرة أولاً ثم من سجلات التدقيق بفلتر user_id — حتى لو فاتتنا الأحداث.
     * ⚡ مُجمَّع: لا نطلق عملية تطهير جديدة لنفس المهاجم أثناء عمل واحدة (يمنع عاصفة REST).
     */
    purgeInFlight = new Map();
    async purgeAttackerArtifacts(guild, attackerId, scheduleRetry = true) {
        const key = `${guild.id}:${attackerId}`;
        if (scheduleRetry) {
            const running = this.purgeInFlight.get(key);
            if (running)
                return running;
        }
        const task = this.doPurgeAttackerArtifacts(guild, attackerId, scheduleRetry);
        if (scheduleRetry)
            this.purgeInFlight.set(key, task);
        try {
            return await task;
        }
        finally {
            if (this.purgeInFlight.get(key) === task)
                this.purgeInFlight.delete(key);
        }
    }
    async doPurgeAttackerArtifacts(guild, attackerId, scheduleRetry = true) {
        let deleted = 0;
        const artKey = `${guild.id}:${attackerId}`;
        const art = this.attackerArtifacts.get(artKey);
        const cutoff = Date.now() - 10 * 60 * 1000;
        /** معرّفات آثار المهاجم — تُزال أيضاً من النسخ الاحتياطية حتى لا تعود بالاستعادة */
        const purgedChannels = new Set();
        const purgedRoles = new Set();
        const deleteChannel = async (id) => {
            if (!id)
                return;
            purgedChannels.add(String(id));
            const ch = guild.channels.cache.get(id);
            if (!ch)
                return;
            try {
                await ch.delete('Liberty City — حذف قناة أنشأها المهاجم');
                deleted++;
            }
            catch { }
        };
        const deleteRole = async (id) => {
            if (!id)
                return;
            purgedRoles.add(String(id));
            const role = guild.roles.cache.get(id);
            if (!role || role.id === guild.id || role.managed)
                return;
            try {
                await role.delete('Liberty City — حذف رول أنشأه المهاجم');
                deleted++;
            }
            catch { }
        };
        const deleteWebhooks = async (ids) => {
            if (!ids.size)
                return;
            try {
                const whs = await guild.fetchWebhooks();
                const tasks = [];
                for (const [, wh] of whs) {
                    if (!ids.has(wh.id))
                        continue;
                    tasks.push(wh.delete('Liberty City — حذف ويب هوك أنشأه المهاجم')
                        .then(() => { deleted++; })
                        .catch(() => { }));
                }
                await Promise.allSettled(tasks);
            }
            catch { }
        };
        // 1) من الذاكرة (أسرع)
        if (art) {
            await Promise.allSettled([...art.channels].map(deleteChannel));
            await Promise.allSettled([...art.roles].map(deleteRole));
            await deleteWebhooks(art.webhooks);
        }
        // 2) من سجلات التدقيق — بالمنفّذ نفسه
        try {
            const [chLogs, roleLogs, whLogs] = await Promise.allSettled([
                guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.ChannelCreate, user: attackerId, limit: 50 }),
                guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.RoleCreate, user: attackerId, limit: 50 }),
                guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.WebhookCreate, user: attackerId, limit: 50 }),
            ]);
            if (chLogs.status === 'fulfilled') {
                const ids = [...chLogs.value.entries.values()]
                    .filter((e) => (e.createdTimestamp ?? 0) >= cutoff && e.targetId)
                    .map((e) => e.targetId);
                await Promise.allSettled(ids.map(deleteChannel));
            }
            if (roleLogs.status === 'fulfilled') {
                const ids = [...roleLogs.value.entries.values()]
                    .filter((e) => (e.createdTimestamp ?? 0) >= cutoff && e.targetId)
                    .map((e) => e.targetId);
                await Promise.allSettled(ids.map(deleteRole));
            }
            if (whLogs.status === 'fulfilled') {
                const ids = new Set([...whLogs.value.entries.values()]
                    .filter((e) => (e.createdTimestamp ?? 0) >= cutoff && e.targetId)
                    .map((e) => e.targetId));
                await deleteWebhooks(ids);
            }
        }
        catch { }
        if (art) {
            art.channels.clear();
            art.roles.clear();
            art.webhooks.clear();
        }
        // 3) 🧼 إزالة آثار المهاجم من النسخ الاحتياطية — حتى لا تعيدها الاستعادة التلقائية
        if (purgedChannels.size || purgedRoles.size) {
            try {
                const doc = await models_1.BackupConfig.findOne({ guildId: guild.id });
                if (doc?.backups?.length) {
                    let changed = false;
                    for (const b of doc.backups) {
                        const data = b?.data;
                        if (!data)
                            continue;
                        if (Array.isArray(data.channels) && purgedChannels.size) {
                            const next = data.channels.filter((c) => !purgedChannels.has(String(c?.id)));
                            if (next.length !== data.channels.length) {
                                data.channels = next;
                                changed = true;
                            }
                        }
                        if (Array.isArray(data.roles) && purgedRoles.size) {
                            const next = data.roles.filter((r) => !purgedRoles.has(String(r?.id)));
                            if (next.length !== data.roles.length) {
                                data.roles = next;
                                changed = true;
                            }
                        }
                    }
                    if (changed) {
                        doc.markModified('backups');
                        await doc.save();
                    }
                }
            }
            catch { /* النسخ الاحتياطية ليست حرجة */ }
        }
        // بعض الأحداث تصل بعد ثوانٍ — جولة ثانية خاطفة
        if (scheduleRetry) {
            setTimeout(() => {
                this.purgeAttackerArtifacts(guild, attackerId, false).catch(() => { });
            }, 2500).unref?.();
        }
        return deleted;
    }
    /** بوت غير مصرح قام بفعل خطير → حظر فوري + حذف ما أنشأه + حادث نشط */
    async handleRogueBot(guild, executor, kind, targetId) {
        try {
            if (executor.id === this.client.user?.id)
                return false;
            const key = `${guild.id}:rogue:${executor.id}`;
            const first = !this.markHandled(key);
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            // البوتات تُمنع دائماً عندما يكون مضاد النيوك مفعّلاً (وضع المنع أو التفاعل)
            if (!cfg?.enabled)
                return false;
            if (await this.isTrustedExecutor(guild, executor.id))
                return false;
            this.startIncident(guild.id, executor.id);
            // احذف الهدف فوراً قبل أي شيء — حتى في المحاولة المتكررة
            if (targetId) {
                if (kind === 'channel') {
                    this.recordArtifact(guild.id, executor.id, 'channels', targetId);
                    guild.channels.cache.get(targetId)?.delete('Liberty City — بوت غير مصرح').catch(() => { });
                }
                else if (kind === 'role') {
                    this.recordArtifact(guild.id, executor.id, 'roles', targetId);
                    const role = guild.roles.cache.get(targetId);
                    if (role && role.id !== guild.id && !role.managed)
                        role.delete('Liberty City — بوت غير مصرح').catch(() => { });
                }
                else if (kind === 'webhook') {
                    this.recordArtifact(guild.id, executor.id, 'webhooks', targetId);
                }
            }
            // ⚡ محاولة أولى: حظر + تطهير + تنبيه. المحاولات التالية: تطهير سريع فقط
            if (!first) {
                void this.purgeAttackerArtifacts(guild, executor.id, false).catch(() => { });
                return true;
            }
            // حظر فوري بالمعرّف (لا ننتظر جلب العضو)
            const banned = await this.banUserById(guild, executor.id, 'Liberty City — بوت غير مصرح قام بعملية تخريب (Anti-Nuke)');
            // 🛡️ لو فشل الحظر (هرمية/صلاحيات): اسحب كل رولاته فوراً حتى لا يكمل
            const stripped = !banned
                ? await this.stripRolesById(guild, executor.id, 'Liberty City — سحب صلاحيات بوت تخريبي (Anti-Nuke)')
                : false;
            // حذف كل آثاره
            const purged = await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
            // تنبيه في الخلفية — لا يعطّل الاستجابة
            void (0, models_1.getGuildSettings)(guild.id)
                .then(s => this.getAlertChannel(guild, s, cfg.logChannel))
                .then(ch => ch
                ?.send({
                content: `🚨 **بوت تخريب — تم احتواءه فوراً**\n` +
                    `🤖 البوت: ${this.userLabel(executor)} (\`${executor.id}\`)\n` +
                    `${banned ? '🔨 حظر فوري ✅' : stripped ? '🗡️ سُحبت كل رولاته (تعذّر الحظر — هرمية)' : '⚠️ تعذّر الحظر وسحب الرولات'}\n` +
                    `🧹 حُذف ${purged} من آثاره (قنوات/رولات/ويب هوكس)`,
            })
                .catch(() => { }))
                .catch(() => { });
            logger.error(`🚨 ROGUE BOT neutralized: ${this.userLabel(executor)} in ${guild.name} | banned=${banned} stripped=${stripped} purged=${purged}`);
            return true;
        }
        catch (error) {
            logger.error(`handleRogueBot error: ${error.message}`);
            return false;
        }
    }
    /** يمنع أي بوت غير مصرح من الدخول — حظر فوري بالمعرّف */
    async guardBotJoin(guild, botId, member) {
        try {
            if (!botId || botId === this.client.user?.id)
                return false;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const antiBot = settings.protection?.antiBot;
            // 🛑 احترام إطفاء antiBot: لو مطفأ فعلاً لا نتدخل
            if (!antiBot?.enabled)
                return false;
            if (this.botWhitelist(settings).has(botId))
                return false;
            // منع التكرار (قد يصل الحدث من Gateway ومن رد الفعل معاً)
            if (this.markHandled(`${guild.id}:botjoin:${botId}`))
                return true;
            this.startIncident(guild.id, botId);
            const banned = await this.banUserById(guild, botId, 'Liberty City — بوت غير مصرح به (Anti-Bot)');
            if (!banned) {
                const target = member ||
                    guild.members.cache.get(botId) ||
                    (await guild.members.fetch(botId).catch(() => null));
                if (target) {
                    await target.kick('Liberty City — بوت غير مصرح به').catch(() => { });
                    // 🛡️ لو الطرد فشل بسبب التسلسل: اسحب كل رولاته حتى لا يملك أي صلاحية
                    await target.roles?.set?.([], 'Liberty City — سحب صلاحيات بوت غير مصرح').catch(() => { });
                }
            }
            void this.getAlertChannel(guild, settings, antiBot?.logChannel)
                .then(ch => ch
                ?.send({
                content: `🤖 **بوت غير مصرح حاول الدخول — تم منعه فوراً**\n` +
                    `البوت: <@${botId}> (\`${botId}\`)\n` +
                    `${banned ? '🔨 حظر فوري ✅ (لا يستطيع العودة)' : '👢 تم طرده'}\n` +
                    `📋 القائمة البيضاء للعرض فقط — لا تمنح أي استثناء. إن كان البوت شرعياً فعطّل antiBot مؤقتاً ثم أعد تفعيله.`,
            })
                .catch(() => { }))
                .catch(() => { });
            logger.warn(`🤖 Bot join blocked: ${botId} in ${guild.name}`);
            return true;
        }
        catch (error) {
            logger.error(`guardBotJoin error: ${error.message}`);
            return false;
        }
    }
    /** يستقبل كل سجل تدقيق من Gateway — يستخدمه للكشف الفوري الاستباقي */
    async onAuditEntry(entry, guildArg) {
        const guild = guildArg ?? entry?.guild;
        if (guild)
            this.ingestAuditEntry(entry, guild.id);
        try {
            const executor = entry?.executor;
            if (!guild || !executor || executor.id === this.client.user?.id)
                return;
            // 🔎 سجل Gateway قد يحمل مستخدماً جزئياً (id فقط) — نحدد هل هو بوت حتى لا يفلت
            if (typeof executor.bot !== 'boolean') {
                const member = guild.members.cache.get(executor.id);
                let isBot = member?.user.bot;
                if (typeof isBot !== 'boolean')
                    isBot = this.client.users.cache.get(executor.id)?.bot;
                if (typeof isBot !== 'boolean') {
                    const fetched = await this.client.users.fetch(executor.id).catch(() => null);
                    if (fetched)
                        isBot = fetched.bot;
                }
                if (typeof isBot === 'boolean')
                    executor.bot = isBot;
            }
            // 🤖 بوت جديد انضم → حظره قبل أن يفعل أي شيء
            if (entry.action === discord_js_1.AuditLogEvent.BotAdd) {
                const targetId = entry.targetId;
                if (!targetId || targetId === this.client.user?.id)
                    return;
                const targetBot = (entry.target && typeof entry.target === 'object' && 'bot' in entry.target && entry.target.bot === true) ||
                    guild.members.cache.get(targetId)?.user.bot === true;
                if (targetBot)
                    await this.guardBotJoin(guild, targetId);
                return;
            }
            // 👑 المالك/المطوّر فقط أحرار تماماً — الوايت ليست لا تمنح شيئاً
            if (await this.isTrustedExecutor(guild, executor.id))
                return;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return; // 🛑 احترام إطفاء مضاد النيوك
            const isBot = this.executorIsBot(guild, executor);
            const action = entry.action;
            const bot = isBot;
            const instantBotActions = new Set([
                discord_js_1.AuditLogEvent.ChannelDelete,
                discord_js_1.AuditLogEvent.RoleDelete,
                discord_js_1.AuditLogEvent.MemberBanAdd,
                discord_js_1.AuditLogEvent.MemberKick,
                discord_js_1.AuditLogEvent.MemberPrune,
                discord_js_1.AuditLogEvent.ThreadDelete,
                discord_js_1.AuditLogEvent.EmojiDelete,
                discord_js_1.AuditLogEvent.StickerDelete,
                discord_js_1.AuditLogEvent.MessageBulkDelete,
                discord_js_1.AuditLogEvent.GuildUpdate,
                discord_js_1.AuditLogEvent.ChannelOverwriteCreate,
                discord_js_1.AuditLogEvent.ChannelOverwriteUpdate,
                discord_js_1.AuditLogEvent.ChannelOverwriteDelete,
                discord_js_1.AuditLogEvent.MemberRoleUpdate,
                discord_js_1.AuditLogEvent.RoleUpdate,
            ]);
            // 🤖 أي بوت غير مصرح: صفر تسامح — أول عملية تخريبية = حظر فوري
            if (bot && instantBotActions.has(action)) {
                const labels = {
                    [discord_js_1.AuditLogEvent.ChannelDelete]: 'حذف قناة',
                    [discord_js_1.AuditLogEvent.RoleDelete]: 'حذف رول',
                    [discord_js_1.AuditLogEvent.MemberBanAdd]: 'حظر أعضاء',
                    [discord_js_1.AuditLogEvent.MemberKick]: 'طرد أعضاء',
                    [discord_js_1.AuditLogEvent.MemberPrune]: 'تنظيف أعضاء (Prune)',
                    [discord_js_1.AuditLogEvent.ThreadDelete]: 'حذف ثريد',
                    [discord_js_1.AuditLogEvent.EmojiDelete]: 'حذف إيموجي',
                    [discord_js_1.AuditLogEvent.StickerDelete]: 'حذف ستيكر',
                    [discord_js_1.AuditLogEvent.MessageBulkDelete]: 'حذف رسائل جماعي',
                    [discord_js_1.AuditLogEvent.GuildUpdate]: 'تعديل إعدادات السيرفر',
                    [discord_js_1.AuditLogEvent.ChannelOverwriteCreate]: 'تعديل صلاحيات قناة',
                    [discord_js_1.AuditLogEvent.ChannelOverwriteUpdate]: 'تعديل صلاحيات قناة',
                    [discord_js_1.AuditLogEvent.ChannelOverwriteDelete]: 'تعديل صلاحيات قناة',
                    [discord_js_1.AuditLogEvent.MemberRoleUpdate]: 'تعديل رولات عضو',
                    [discord_js_1.AuditLogEvent.RoleUpdate]: 'تعديل رول',
                };
                await this.handleInstantViolation(guild, executor, settings, cfg, labels[action] ?? 'عملية تخريبية', { forceBan: true });
                return;
            }
            // 🤖 بوت ينشئ قناة/رول/ويب هوك/ثريد → حظر فوري + حذف ما أنشأه
            if (bot) {
                if (action === discord_js_1.AuditLogEvent.ChannelCreate ||
                    action === discord_js_1.AuditLogEvent.ThreadCreate) {
                    await this.handleRogueBot(guild, executor, 'channel', entry.targetId);
                    return;
                }
                if (action === discord_js_1.AuditLogEvent.RoleCreate) {
                    await this.handleRogueBot(guild, executor, 'role', entry.targetId);
                    return;
                }
                if (action === discord_js_1.AuditLogEvent.WebhookCreate) {
                    await this.handleRogueBot(guild, executor, 'webhook', entry.targetId);
                    return;
                }
            }
            // 🔨 حذف قناة/رول من أي حساب غير موثوق → أول عملية = تحييد فوري
            if (action === discord_js_1.AuditLogEvent.ChannelDelete || action === discord_js_1.AuditLogEvent.RoleDelete) {
                await this.handleInstantViolation(guild, executor, settings, cfg, action === discord_js_1.AuditLogEvent.ChannelDelete ? 'حذف قناة' : 'حذف رول', { forceBan: cfg.mode !== 'react' });
                return;
            }
            // 🔨 حظر/طرد جماعي (الإنسان يُسمح له بعملية واحدة، والثانية خلال 10ث = هجوم)
            if (action === discord_js_1.AuditLogEvent.MemberBanAdd || action === discord_js_1.AuditLogEvent.MemberKick) {
                const kind = action === discord_js_1.AuditLogEvent.MemberBanAdd ? 'ban' : 'kick';
                if (!isBot) {
                    const count = this.trackActionOnce(guild.id, executor.id, kind, entry.targetId, 10000);
                    if (count < 2)
                        return;
                }
                await this.handleInstantViolation(guild, executor, settings, cfg, action === discord_js_1.AuditLogEvent.MemberBanAdd ? 'حظر جماعي' : 'طرد جماعي', { forceBan: true });
                // إلغاء حظر الضحية إن أمكن
                if (action === discord_js_1.AuditLogEvent.MemberBanAdd && entry.targetId) {
                    void guild.members
                        .unban(entry.targetId, 'Liberty City Anti-Nuke: إلغاء حظر الضحية تلقائياً')
                        .catch(() => { });
                }
                return;
            }
            // 🧹 Prune جماعي
            if (action === discord_js_1.AuditLogEvent.MemberPrune) {
                await this.handleInstantViolation(guild, executor, settings, cfg, 'تنظيف أعضاء (Prune)', {
                    forceBan: true,
                });
                return;
            }
            // 🧵 حذف ثريدات / إيموجي / ستيكر — عتبة سريعة للإنسان، فوري للبوت (تم أعلاه)
            if (action === discord_js_1.AuditLogEvent.ThreadDelete ||
                action === discord_js_1.AuditLogEvent.EmojiDelete ||
                action === discord_js_1.AuditLogEvent.StickerDelete) {
                const key = action === discord_js_1.AuditLogEvent.ThreadDelete ? 'channel' : action === discord_js_1.AuditLogEvent.EmojiDelete ? 'emoji' : 'sticker';
                const limit = action === discord_js_1.AuditLogEvent.ThreadDelete ? 3 : 5;
                const count = this.track(guild.id, key, 10000);
                if (count < limit)
                    return;
                this.deletionTracker.get(guild.id)[key] = [];
                await this.handleInstantViolation(guild, executor, settings, cfg, 'حذف جماعي', {
                    forceBan: cfg.mode !== 'react',
                });
                return;
            }
            // 🏗️ إنشاء قنوات/رولات/ثريدات بسرعة
            //    قنوات/رولات: 2+ خلال 5ث — ثريدات: 3+ خلال 10ث
            if (action === discord_js_1.AuditLogEvent.ChannelCreate ||
                action === discord_js_1.AuditLogEvent.ThreadCreate ||
                action === discord_js_1.AuditLogEvent.RoleCreate) {
                const isThread = action === discord_js_1.AuditLogEvent.ThreadCreate;
                const kind = isThread
                    ? 'thread'
                    : action === discord_js_1.AuditLogEvent.RoleCreate
                        ? 'role'
                        : 'channel';
                const windowMs = isThread ? 10000 : 5000;
                const limit = isThread ? 3 : 2;
                const count = this.trackCreateOnce(guild.id, executor.id, kind, entry.targetId, windowMs);
                if (count < limit)
                    return;
                await this.handleInstantViolation(guild, executor, settings, cfg, isThread
                    ? 'إنشاء ثريدات جماعي'
                    : action === discord_js_1.AuditLogEvent.RoleCreate
                        ? 'إنشاء رولات جماعي'
                        : 'إنشاء قنوات جماعي', {
                    forceBan: cfg.mode !== 'react',
                    targetId: entry.targetId,
                    deleteTargetKind: (isThread ? 'channel' : kind),
                });
                return;
            }
            // 🔗 إنشاء ويب هوك — بوت تم أعلاه، الإنسان: أول ويب هوك غير مصرح = تحييد
            if (action === discord_js_1.AuditLogEvent.WebhookCreate) {
                const count = this.trackCreateOnce(guild.id, executor.id, 'webhook', entry.targetId, 10000);
                if (count < 1)
                    return;
                await this.handleInstantViolation(guild, executor, settings, cfg, 'إنشاء ويب هوك غير مصرح', {
                    forceBan: cfg.mode !== 'react',
                });
                return;
            }
            // ✏️ تغيير اسم قناة بسرعة (الإنسان: 2+ خلال 5ث) — البوت يُحظر من أول تغيير
            if (action === discord_js_1.AuditLogEvent.ChannelUpdate) {
                const nameChange = (entry.changes || []).find((c) => c.key === 'name');
                if (!nameChange)
                    return;
                if (!isBot) {
                    const count = this.trackRename(guild.id, executor.id, 5000);
                    if (count < 2 && !this.isActiveAttacker(guild.id, executor.id))
                        return;
                }
                // استرجاع الاسم القديم فوراً
                const channel = guild.channels.cache.get(entry.targetId);
                if (channel && nameChange.old) {
                    channel.setName(String(nameChange.old), 'Liberty City — استرجاع اسم القناة').catch(() => { });
                }
                await this.handleInstantViolation(guild, executor, settings, cfg, 'تغيير اسم قناة سريع', {
                    forceBan: isBot || cfg.mode !== 'react',
                });
                return;
            }
        }
        catch (error) {
            logger.error(`onAuditEntry error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 🕵️ حارس البوتات الخطرة الموجودين أصلاً
    // --------------------------------------------
    startDangerousBotWatchdog(guild) {
        if (this.botGuardTimers.has(guild.id))
            return;
        const run = () => this.auditDangerousBots(guild).catch(() => { });
        // ⚡ فحص أول فوري — لا نترك نافذة 4 ثوانٍ يستغلها المهاجم
        void run();
        const timer = setInterval(run, 10000);
        timer.unref?.();
        this.botGuardTimers.set(guild.id, timer);
    }
    async auditDangerousBots(guild) {
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            const antiBot = settings.protection?.antiBot;
            // 🛑 احترام إطفاء antiBot: لا تحييد لبوتات موجودة إذا كانت الحماية مطفأة
            if (!antiBot?.enabled)
                return;
            const wl = this.botWhitelist(settings);
            const dangerous = [];
            for (const [, member] of guild.members.cache) {
                if (!member.user.bot || wl.has(member.id))
                    continue;
                const p = member.permissions;
                // بوت "قادر على النيوك": أي صلاحية تخريبية منفردة تكفي — لا ننتظر اجتماعها
                const nukeCapable = p.has(discord_js_1.PermissionFlagsBits.Administrator) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageGuild) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageChannels) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageRoles) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageWebhooks) ||
                    p.has(discord_js_1.PermissionFlagsBits.BanMembers) ||
                    p.has(discord_js_1.PermissionFlagsBits.KickMembers) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageThreads);
                if (nukeCapable)
                    dangerous.push(member);
            }
            if (dangerous.length === 0)
                return;
            const names = [];
            for (const member of dangerous) {
                const backoffKey = `${guild.id}:${member.id}`;
                const retryAt = this.botGuardBackoff.get(backoffKey);
                if (retryAt && Date.now() < retryAt)
                    continue; // صامت: لا إعادة محاولة الآن
                this.startIncident(guild.id, member.id);
                const ok = await this.banUserById(guild, member.id, 'Liberty City — بوت خطِر غير مصرح (حارس البوتات)');
                if (ok) {
                    this.botGuardBackoff.delete(backoffKey);
                    names.push(`${member.user.tag} (حظر)`);
                }
                else {
                    const stripped = await member.roles
                        .set([], 'Liberty City — سحب صلاحيات بوت خطِر')
                        .then(() => true)
                        .catch(() => false);
                    if (stripped) {
                        this.botGuardBackoff.delete(backoffKey);
                        names.push(`${member.user.tag} (سحب رولات)`);
                    }
                    else {
                        // 🔕 فشل بسبب التسلّم → صامت تماماً + تهدئة 10 دقائق (بدون أي رسالة)
                        this.botGuardBackoff.set(backoffKey, Date.now() + 10 * 60 * 1000);
                        logger.warn(`Bot guard could not neutralize ${member.user.tag} in ${guild.name} (hierarchy)`);
                    }
                }
                await this.purgeAttackerArtifacts(guild, member.id, false).catch(() => 0);
            }
            if (names.length) {
                const ch = await this.getAlertChannel(guild, settings, cfg.logChannel);
                ch?.send({
                    content: `🛡️ **حارس البوتات:** تم تحييد ${names.length} بوت بصلاحيات تخريبية\n` +
                        names.slice(0, 10).map(n => `• ${n}`).join('\n') +
                        `\n📋 القائمة البيضاء للعرض فقط — لا تمنح أي استثناء. إن كان أحدها شرعياً فعطّل antiBot مؤقتاً.`,
                }).catch(() => { });
                logger.warn(`🛡️ Dangerous bots neutralized in ${guild.name}: ${names.join(', ')}`);
            }
        }
        catch (error) {
            logger.error(`auditDangerousBots error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 💬 ويب هوك / بوت يسبام → حذف فوري + حظر
    // --------------------------------------------
    async onWebhookMessage(message) {
        try {
            if (!message?.guild || !message.webhookId)
                return false;
            const guild = message.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const nuke = settings.protection?.antiNuke;
            const spam = settings.protection?.antiSpam;
            // يحترم الإطفاء: لو الاثنان مطفآن لا نتدخل
            if (!nuke?.enabled && !spam?.enabled)
                return false;
            const key = `${guild.id}:wh:${message.webhookId}`;
            const now = Date.now();
            const arr = (this.messageRate.get(key) || []).filter(t => now - t < 3000);
            arr.push(now);
            this.messageRate.set(key, arr);
            const content = typeof message.content === 'string' ? message.content : '';
            const massMention = message.mentions?.everyone === true ||
                (message.mentions?.users?.size ?? 0) >= 5 ||
                (message.mentions?.roles?.size ?? 0) >= 3;
            const invite = /discord\.(gg|com\/invite)|discordapp\.com\/invite/i.test(content);
            const scam = /(?:free|nitro|steam|airdrop|claim).*(?:discord\.gg|bit\.ly|tinyurl|cutt\.ly)/i.test(content);
            const threshold = Math.max(4, Number(spam?.maxMessages) || 5);
            if (!massMention && !invite && !scam && arr.length < threshold)
                return false;
            // 1) احذف الرسالة فوراً (قبل أي انتظار)
            await message.delete().catch(() => { });
            const keyHandled = `${guild.id}:wh-handle:${message.webhookId}`;
            if (this.markHandled(keyHandled))
                return true;
            // 2) احذف الويب هوك فوراً + استخرج مالكه بالجلب
            let whOwnerId;
            let whName = 'unknown';
            try {
                const target = (await guild.fetchWebhooks()).get(message.webhookId);
                whOwnerId = target?.owner?.id;
                whName = target?.name ?? whName;
                await target?.delete('Liberty City — Anti-Webhook-Spam').catch(() => { });
            }
            catch { /* تجاهل */ }
            // 3) احذف رسائل الويب هوك السابقة
            void this.cleanupChannelMessages(message, (m) => m.webhookId === message.webhookId);
            // 4) حدّد صانع الويب هوك: بثّ التدقيق → REST → مالك الويب هوك
            let creator = await this.findAuditCreator(guild, discord_js_1.AuditLogEvent.WebhookCreate, message.webhookId);
            if (!creator && whOwnerId) {
                creator =
                    guild.client.users.cache.get(whOwnerId) ||
                        (await this.client.users.fetch(whOwnerId).catch(() => null));
            }
            this.recordArtifact(guild.id, creator?.id ?? 'unknown', 'webhooks', message.webhookId);
            let actionText = '🗑️ حذف الرسائل والويب هوك';
            if (creator && creator.id !== this.client.user?.id) {
                const trusted = await this.isTrustedExecutor(guild, creator.id);
                if (!trusted && nuke?.enabled) {
                    // 🚨 صفر تسامح: صانع الويب هوك يُحظر فوراً — ولو تعذّر الحظر تُسحب كل رولاته
                    const text = await this.neutralizeById(guild, creator, nuke, 'Liberty City — سبام ويب هوك (Anti-Nuke)', nuke.mode !== 'react');
                    actionText += `\n${text}`;
                    // 🧹 احذف كل ويب هوكاته الأخرى حتى لا يكمل من واحدة ثانية
                    try {
                        const all = await guild.fetchWebhooks();
                        await Promise.allSettled([...all.values()]
                            .filter((w) => w?.owner?.id === creator.id)
                            .map((w) => w.delete('Liberty City — حذف ويب هوكات المهاجم')));
                    }
                    catch { /* تجاهل */ }
                    await this.purgeAttackerArtifacts(guild, creator.id).catch(() => 0);
                }
                else if (!trusted) {
                    actionText += '\n⚠️ مضاد النيوك مطفأ — لم تُنفّذ عقوبة (حذف الرسائل فقط)';
                }
                else {
                    actionText += '\n👑 المنشئ موثوق — احتُوي الويب هوك فقط';
                }
            }
            else if (!creator) {
                actionText += '\n⚠️ تعذّر تحديد صانع الويب هوك — احتُوي الهجوم';
            }
            const ch = await this.getAlertChannel(guild, settings, nuke?.logChannel);
            ch?.send({
                content: `🚨 **سبام ويب هوك — تم إيقافه فوراً**\n` +
                    `🔗 الويب هوك: \`${whName}\` (\`${message.webhookId}\`)\n` +
                    `👤 الصانع: ${creator ? `${creator} (\`${creator.id}\`)` : 'غير معروف'}\n` +
                    `📢 القناة: <#${message.channelId}>\n` +
                    `${actionText}\n` +
                    `السبب: ${massMention ? '@everyone / منشن جماعي' : invite ? 'رابط دعوة' : scam ? 'رابط احتيالي' : `${arr.length} رسائل في 3 ثوانٍ`}`,
            }).catch(() => { });
            logger.warn(`🚨 Webhook spam contained in ${guild.name} (${message.webhookId})`);
            return true;
        }
        catch (error) {
            logger.error(`onWebhookMessage error: ${error.message}`);
            return false;
        }
    }
    async onBotMessage(message) {
        try {
            if (!message?.guild || !message.author?.bot || message.webhookId)
                return false;
            const guild = message.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return false;
            if (this.botWhitelist(settings).has(message.author.id))
                return false;
            const key = `${guild.id}:bot:${message.author.id}`;
            const now = Date.now();
            const arr = (this.messageRate.get(key) || []).filter(t => now - t < 3000);
            arr.push(now);
            this.messageRate.set(key, arr);
            const content = typeof message.content === 'string' ? message.content : '';
            const massMention = message.mentions?.everyone === true ||
                (message.mentions?.users?.size ?? 0) >= 5 ||
                (message.mentions?.roles?.size ?? 0) >= 3;
            const invite = /discord\.(gg|com\/invite)|discordapp\.com\/invite/i.test(content);
            const threshold = 8;
            if (!(massMention && arr.length >= 2) && !invite && arr.length < threshold)
                return false;
            const handledKey = `${guild.id}:bot-handle:${message.author.id}`;
            if (this.markHandled(handledKey))
                return true;
            this.startIncident(guild.id, message.author.id);
            void this.cleanupChannelMessages(message, (m) => m.author?.id === message.author.id);
            const banned = await this.banUserById(guild, message.author.id, 'Liberty City — سبام من بوت غير مصرح (Anti-Nuke)');
            await this.purgeAttackerArtifacts(guild, message.author.id).catch(() => 0);
            const ch = await this.getAlertChannel(guild, settings, cfg.logChannel);
            ch?.send({
                content: `🚨 **بوت يسبام — تم إيقافه فوراً**\n` +
                    `🤖 ${message.author.tag} (\`${message.author.id}\`)\n` +
                    `📢 القناة: <#${message.channelId}> — ${arr.length} رسائل/3 ثوانٍ\n` +
                    `${banned ? '🔨 حظر فوري ✅' : '⚠️ تعذّر الحظر'}`,
            }).catch(() => { });
            logger.warn(`🚨 Spamming bot neutralized: ${message.author.tag} in ${guild.name}`);
            return true;
        }
        catch (error) {
            logger.error(`onBotMessage error: ${error.message}`);
            return false;
        }
    }
    async cleanupChannelMessages(message, predicate) {
        try {
            const channel = message.channel;
            if (!channel?.messages?.fetch)
                return;
            const fetched = await channel.messages.fetch({ limit: 50 });
            const targets = [...fetched.values()].filter(predicate);
            if (targets.length === 0)
                return;
            if (targets.length > 1 && typeof channel.bulkDelete === 'function') {
                await channel.bulkDelete(targets, true).catch(async () => {
                    for (const m of targets)
                        await m.delete().catch(() => { });
                });
            }
            else {
                for (const m of targets)
                    await m.delete().catch(() => { });
            }
        }
        catch { }
    }
    // معاقبة المخالف (تجاهل: المالك، البوت نفسه، غير الموجود)
    // نوع العقوبة: alert | kick | ban | strip (سلب كل الرولات)
    async punish(guild, executor, action, reason) {
        if (executor.id === guild.ownerId)
            return '⏭️ المالك مستثناً';
        if (executor.id === this.client.user?.id)
            return '⏭️ البوت مستثنى';
        const devId = process.env.DEVELOPER_USER_ID;
        if (devId && executor.id === devId)
            return '⏭️ مطوّر البوت مستثنى';
        const member = guild.members.cache.get(executor.id) ||
            (await guild.members.fetch(executor.id).catch(() => null));
        if (!member)
            return '⚠️ المخالف لم يعد عضواً';
        // 🛡️ فحص التسلّم قبل التنفيذ — أخطر حالة: عقوبة تفشل بصمت
        const me = guild.members.me;
        if (me) {
            const botTop = me.roles.highest;
            const targetTop = member.roles.highest;
            if (targetTop.comparePositionTo(botTop) >= 0) {
                // صامت تماماً — لا نرسل أي رسالة عن رولات أعلى من البوت
                logger.warn(`Punish blocked (hierarchy) in ${guild.name} — target above bot`);
                return '⚠️ تعذّر تنفيذ العقوبة';
            }
        }
        try {
            if (action === 'ban') {
                await member.ban({ reason });
                return '🔨 تم حظر المخالف';
            }
            if (action === 'kick') {
                await member.kick(reason);
                return '👢 تم طرد المخالف';
            }
            if (action === 'strip') {
                const target = [...member.roles.cache.values()].filter(r => r.id !== guild.id && !r.managed);
                if (target.length === 0)
                    return '⚠️ المخالف بلا رولات لسحبها';
                try {
                    // 🗡️ سحب الرولات من العضو نفسه — وليس حذف الرولات من السيرفر!
                    await member.roles.remove(target, reason);
                    return `🗡️ تم سلب **${target.length}** رولة — باقٍ في السيرفر بلا صلاحيات`;
                }
                catch (error) {
                    logger.warn(`Strip failed in ${guild.name}: ${error.message}`);
                    return '⚠️ تعذّر سلب الرولات';
                }
            }
        }
        catch (error) {
            logger.warn(`punish failed (${action}) in ${guild.name}: ${error.message}`);
            return '⚠️ تعذّر تنفيذ العقوبة';
        }
        return '📢 تم الإشعار فقط';
    }
    // تتبّع الحذف → يعيد العدد داخل النافذة الزمنية
    track(guildId, type, windowMs) {
        const now = Date.now();
        let tracker = this.deletionTracker.get(guildId);
        if (!tracker) {
            tracker = { channel: [], role: [], ban: [], kick: [], emoji: [], sticker: [] };
            this.deletionTracker.set(guildId, tracker);
        }
        tracker[type].push(now);
        tracker[type] = tracker[type].filter(t => now - t <= windowMs);
        return tracker[type].length;
    }
    // --------------------------------------------
    // 0) HIERARCHY GUARD — فحص تسلّم البوت
    // --------------------------------------------
    // أهم فحص أمني: لو رول فوق البوت، كل العقوبات تفشل بصمت
    // (Discord يمنع المساس بأحد أعلى منك في الرتب مهما كانت صلاحياتك)
    checkHierarchy(guild) {
        return computeHierarchy(guild);
    }
    /**
     * يبلّغ عن مشكلة التسلّم — **عند تغيّر الحالة فقط** حتى لا نكرّر التنبيه
     * يستدعى: عند الإقلاع، عند الانضمام، وعند كل محاولة عقوبة فاشلة
     */
    async ensureHierarchyAlert(guild) {
        const status = this.checkHierarchy(guild);
        try {
            const known = this.hierarchyState.get(guild.id);
            // الحالة لم تتغيّر → لا نعيد التنبيه
            if (known !== undefined && known === status.ok)
                return status;
            // أول فحص على سيرفر سليم → نسجّل الحالة فقط **بدون أي رسالة**
            // (وإلا يُبلّغ البوت "تم الإصلاح" وهو لم يُصلَح شيء بعد)
            if (known === undefined && status.ok) {
                this.hierarchyState.set(guild.id, true);
                return status;
            }
            this.hierarchyState.set(guild.id, status.ok);
            // 🔕 صامت تماماً — لا رسائل تلقائية في السيرفر
            //    (الفحص اليدوي فقط عبر /protection hierarchy)
            if (status.ok) {
                logger.info(`✅ Hierarchy fixed in ${guild.name} — البوت الآن أعلى رتبة`);
            }
            else {
                logger.warn(`🚨 Hierarchy: bot NOT top in ${guild.name} | bot=#${status.botPosition} | offenders=${status.offenderCount}`);
            }
            return status;
        }
        catch (error) {
            logger.error(`ensureHierarchyAlert error: ${error.message}`);
        }
        return status;
    }
    // وايت ليست للعرض فقط (تاج 👑) — الوايت ليست المخصصة لم تعد تمنح أي استثناء
    async isWhitelisted(guild, executorId) {
        if (executorId === guild.ownerId)
            return true;
        // مطوّر البوت (DEVELOPER_USER_ID من .env)
        const devId = process.env.DEVELOPER_USER_ID;
        if (devId && executorId === devId)
            return true;
        const member = guild.members.cache.get(executorId);
        if (member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
            return true;
        return false;
    }
    // 👑 المنفّذ الموثوق: المالك + مطوّر البوت فقط
    //    🚫 الوايت ليست (المستخدمون والبوتات) لم تعد تمنع العقوبة — الجميع متساوٍ
    async isTrustedExecutor(guild, executorId) {
        if (executorId === guild.ownerId)
            return true;
        const devId = process.env.DEVELOPER_USER_ID;
        if (devId && executorId === devId)
            return true;
        return false;
    }
    /** هل المنفّذ بوت؟ — يعمل حتى لو كان كائن المستخدم جزئياً (من سجلات التدقيق) */
    executorIsBot(guild, executor) {
        if (!executor)
            return false;
        if (executor.bot === true)
            return true;
        if (executor.bot === false)
            return false;
        if (guild.members.cache.get(executor.id)?.user.bot === true)
            return true;
        return this.client.users.cache.get(executor.id)?.bot === true;
    }
    /** اسم مقروء للمنفّذ حتى لو كان جزئياً */
    userLabel(user) {
        return user?.tag || user?.username || user?.id || 'unknown';
    }
    // --------------------------------------------
    // 0) ANTI-CREATE: أي بوت ينشئ قناة/رول → يُحذف فوراً (ماعدا الأونر والإدارة)
    // --------------------------------------------
    async onChannelCreate(channel) {
        try {
            if (!channel?.guild)
                return;
            if (this.handledTargets.has(`${channel.guild.id}:ch-target:${channel.id}`))
                return;
            const guild = channel.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            // 🛑 احترام الإطفاء — لا حماية عندما يكون مضاد النيوك مطفأ
            if (!cfg?.enabled)
                return;
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.ChannelCreate, channel.id, 1500, 15000);
            if (!executor)
                return; // بثّ التدقيق سيصل غالباً — لا نحذف عمياء (قد نحذف قناة استعادة)
            if (executor.id === this.client.user?.id)
                return;
            if (await this.isTrustedExecutor(guild, executor.id))
                return;
            this.recordArtifact(guild.id, executor.id, 'channels', channel.id);
            this.handledTargets.set(`${guild.id}:ch-target:${channel.id}`, Date.now());
            // 🤖 بوت غير مصرح: صفر تسامح — حظر فوري + حذف القناة + كل آثاره
            if (this.executorIsBot(guild, executor)) {
                await this.handleRogueBot(guild, executor, 'channel', channel.id);
                return;
            }
            // 🧑 إنسان: قناة واحدة قد تكون طبيعية — نتدخل عند الانفجار (2+ خلال 5 ثوانٍ)
            //    أو إذا كان الحادث نشطاً على نفس المنفّذ.
            const burst = this.trackCreateOnce(guild.id, executor.id, 'channel', channel.id, 5000);
            const suspiciousName = /nuked|hacked|kly|cracked|death.?note|pwned|on.?top|raid|destroy/i.test(channel.name || '');
            if (burst < 2 && !suspiciousName && !this.isActiveAttacker(guild.id, executor.id))
                return;
            this.startIncident(guild.id, executor.id);
            channel.delete('Liberty City — إنشاء قنوات جماعي (Anti-Nuke)').catch(() => { });
            if (burst >= 2 || suspiciousName) {
                const reason = 'Liberty City — إنشاء قنوات جماعي مشبوه (Anti-Nuke)';
                const prevent = cfg.mode !== 'react';
                const text = await this.neutralizeById(guild, executor, cfg, reason, prevent);
                await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
                void this.getAlertChannel(guild, settings, cfg.logChannel)
                    .then(ch => ch
                    ?.send({
                    content: `🚨 **هجوم إنشاء قنوات — تم احتواؤه**\n` +
                        `👤 ${this.userLabel(executor)} (${this.executorIsBot(guild, executor) ? '🤖 بوت' : '🧑 عضو'})\n` +
                        `📢 أنشأ ${burst} قنوات خلال 5 ثوانٍ\n` +
                        `${text}\n🧹 حُذفت قنوات المهاجم`,
                })
                    .catch(() => { }))
                    .catch(() => { });
            }
        }
        catch (error) {
            logger.error(`onChannelCreate error: ${error.message}`);
        }
    }
    // عدّاد إنشاء سريع لكل منفّذ (نافذة زمنية)
    trackCreate(guildId, userId, kind, windowMs) {
        const now = Date.now();
        const key = `${guildId}:${kind}:${userId}`;
        const arr = (this.createTracker.get(key) || []).filter(t => now - t <= windowMs);
        arr.push(now);
        this.createTracker.set(key, arr);
        return arr.length;
    }
    /**
     * عدّاد إنشاء لا يعدّ نفس الهدف مرتين.
     * ضروري لأن الحدث وسجل التدقيق يصلان معاً لنفس القناة/الرول — بدون هذا
     * كان إنشاء واحد يُحسب مرتين ويُعاقب عضو عادي ظلماً.
     */
    trackCreateOnce(guildId, userId, kind, targetId, windowMs) {
        if (!targetId)
            return this.trackCreate(guildId, userId, kind, windowMs);
        const dedupeKey = `${guildId}:create-once:${kind}:${targetId}`;
        const seen = this.handledTargets.get(dedupeKey);
        if (seen && Date.now() - seen < 30000) {
            // سبق عدّه — نرجع العدد الحالي بدون زيادة
            const key = `${guildId}:${kind}:${userId}`;
            const arr = (this.createTracker.get(key) || []).filter(t => Date.now() - t <= windowMs);
            this.createTracker.set(key, arr);
            return arr.length;
        }
        this.handledTargets.set(dedupeKey, Date.now());
        return this.trackCreate(guildId, userId, kind, windowMs);
    }
    /**
     * عدّاد حظر/طرد لكل منفّذ مع منع احتساب نفس الهدف مرتين
     * (حدث الحظر + سجل التدقيق يصلان لنفس العملية).
     */
    trackActionOnce(guildId, executorId, type, targetId, windowMs) {
        const now = Date.now();
        const key = `${guildId}:${type}:${executorId}`;
        if (targetId) {
            const dedupeKey = `${guildId}:action-once:${type}:${targetId}`;
            const seen = this.handledTargets.get(dedupeKey);
            if (seen && now - seen < 30000) {
                const arr = (this.actionTracker.get(key) || []).filter(t => now - t <= windowMs);
                this.actionTracker.set(key, arr);
                return arr.length;
            }
            this.handledTargets.set(dedupeKey, now);
        }
        const arr = (this.actionTracker.get(key) || []).filter(t => now - t <= windowMs);
        arr.push(now);
        this.actionTracker.set(key, arr);
        return arr.length;
    }
    async onRoleCreate(role) {
        try {
            if (!role?.guild || role.managed)
                return;
            const guild = role.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.RoleCreate, role.id, 1500, 15000);
            if (!executor)
                return;
            if (executor.id === this.client.user?.id)
                return;
            if (await this.isTrustedExecutor(guild, executor.id))
                return;
            this.recordArtifact(guild.id, executor.id, 'roles', role.id);
            // 🤖 بوت غير مصرح: صفر تسامح
            if (this.executorIsBot(guild, executor)) {
                await this.handleRogueBot(guild, executor, 'role', role.id);
                return;
            }
            // 🧑 إنسان: انفجار 2+ خلال 5 ثوانٍ أو اسم مشبوه أو حادث نشط
            const burst = this.trackCreateOnce(guild.id, executor.id, 'role', role.id, 5000);
            const suspiciousName = /nuked|hacked|kly|cracked|death.?note|pwned|on.?top|raid|destroy/i.test(role.name || '');
            if (burst < 2 && !suspiciousName && !this.isActiveAttacker(guild.id, executor.id))
                return;
            this.startIncident(guild.id, executor.id);
            role.delete('Liberty City — إنشاء رولات جماعي (Anti-Nuke)').catch(() => { });
            if (burst >= 2 || suspiciousName) {
                const prevent = cfg.mode !== 'react';
                const text = await this.neutralizeById(guild, executor, cfg, 'Liberty City — إنشاء رولات جماعي مشبوه (Anti-Nuke)', prevent);
                await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
                void this.getAlertChannel(guild, settings, cfg.logChannel)
                    .then(ch => ch
                    ?.send({
                    content: `🚨 **هجوم إنشاء رولات — تم احتواؤه**\n` +
                        `👤 ${this.userLabel(executor)} (${this.executorIsBot(guild, executor) ? '🤖 بوت' : '🧑 عضو'})\n` +
                        `🎭 أنشأ ${burst} رولات خلال 5 ثوانٍ\n` +
                        `${text}\n🧹 حُذفت رولات المهاجم`,
                })
                    .catch(() => { }))
                    .catch(() => { });
            }
        }
        catch (error) {
            logger.error(`onRoleCreate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 0b) ANTI-RENAME: تغيير اسم قناة → إرجاع فوري + عقوبة
    // --------------------------------------------
    async onChannelUpdate(oldChannel, newChannel) {
        try {
            if (!newChannel?.guild || oldChannel.name === newChannel.name)
                return;
            const guild = newChannel.guild;
            // ⚡ بثّ التدقيق الفوري أولاً — ثم REST احتياطي (بدون اشتراط وجود العضو في الكاش)
            const entry = await this.findAuditEntry(guild, discord_js_1.AuditLogEvent.ChannelUpdate, newChannel.id, 1500, 6000);
            if (!entry?.executor)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (await this.isTrustedExecutor(guild, entry.executor.id))
                return; // 👑 موثوق يغيّر بحرية
            // 📋 جلب الإعدادات
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const antiNuke = settings.protection?.antiNuke;
            if (!antiNuke?.enabled)
                return;
            const isBot = this.executorIsBot(guild, entry.executor);
            const count = this.trackRename(guild.id, entry.executor.id, 5000);
            const nameChange = (entry.changes || []).find((c) => c.key === 'name');
            const oldName = nameChange?.old ? String(nameChange.old) : oldChannel.name;
            // 1️⃣ إرجاع الاسم فوراً — حتى لو لم نعاقب (تغيير واحد من إنسان قد يكون طبيعياً)
            const me = guild.members.me;
            const canManageChannels = me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels) ?? false;
            let nameRestored = false;
            if (canManageChannels) {
                try {
                    await newChannel.setName(oldName, 'Liberty City — استرجاع اسم القناة');
                    nameRestored = true;
                }
                catch (e) {
                    logger.warn(`Failed to restore channel name in ${guild.name}: ${e.message}`);
                }
            }
            // 🧑 إنسان: تغيير واحد = استرجاع فقط. 2+ خلال 5 ثوانٍ = هجوم.
            // 🤖 بوت: أول تغيير = حظر فوري.
            if (!isBot && count < 2 && !this.isActiveAttacker(guild.id, entry.executor.id)) {
                logger.info(`✏️ Channel rename reverted in ${guild.name} (single change by ${this.userLabel(entry.executor)})`);
                return;
            }
            // 2️⃣ العقوبة — وضع المنع = حظر فوري، ولو فشل نسحب كل الرولات
            const prevent = antiNuke.mode !== 'react';
            const text = await this.neutralizeById(guild, entry.executor, antiNuke, 'Liberty City — تغيير أسماء القنوات بسرعة (Anti-Nuke)', isBot || prevent);
            await this.purgeAttackerArtifacts(guild, entry.executor.id).catch(() => 0);
            // 3️⃣ إرسال التقرير
            const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
            const executorType = isBot ? '🤖 بوت' : '👤 عضو';
            alert?.send({
                content: `✏️ **${executorType} غيّر اسم قناة${count > 1 ? ` ${count} مرات/5 ثوانٍ` : ''}:** ${entry.executor.tag}\n` +
                    `📝 القناة: <#${newChannel.id}>\n` +
                    `🔄 استرجاع الاسم: ${nameRestored ? '✅ تم' : canManageChannels ? '❌ فشل' : '⚠️ لا توجد صلاحية ManageChannels'}\n` +
                    `🛡️ ${text}`,
            }).catch(() => { });
        }
        catch (error) {
            logger.error(`onChannelUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 0c) ANTI-PERMISSION: تعديل صلاحيات → إرجاع فوري + عقوبة
    // --------------------------------------------
    async cleanupSuspicious(guild) {
        let deleted = 0;
        const pattern = /nuked|hacked|kly|rcl|cracked|death.?note|pwned|owned|here|on.?top|spam|raid|destroy|test.?123/i;
        for (const [, ch] of guild.channels.cache) {
            if (pattern.test(ch.name)) {
                try {
                    await ch.delete('Security: auto-cleanup suspicious channel');
                    deleted++;
                }
                catch { }
            }
        }
        for (const [, role] of guild.roles.cache) {
            if (role.id === guild.id || role.managed)
                continue;
            if (pattern.test(role.name)) {
                try {
                    await role.delete('Security: auto-cleanup suspicious role');
                    deleted++;
                }
                catch { }
            }
        }
        if (deleted > 0) {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const alert = await this.getAlertChannel(guild, settings);
            alert?.send({ content: `🧹 **تنظيف تلقائي:** تم حذف ${deleted} روم/رول مشبوه` }).catch(() => { });
        }
        return deleted;
    }
    // --------------------------------------------
    // Pro Max: ANTI-WEBHOOK SPAM — ويب هوك → حذف فوري + عقوبة
    // --------------------------------------------
    async onWebhookUpdate(webhook) {
        try {
            if (!webhook?.guild)
                return;
            const guild = webhook.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return; // احترام الإطفاء
            // ⚡ ابحث عن المنفّذ من بثّ التدقيق أولاً (ينتظر حتى 1.5ث) ثم REST
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.WebhookCreate, webhook.id, 1500, 15000);
            if (executor) {
                if (executor.id === this.client.user?.id)
                    return;
                // 👑 الموثوق لا يُحذف ويب هوكه ولا يُعاقب
                if (await this.isTrustedExecutor(guild, executor.id))
                    return;
            }
            // 🗑️ حذف فوري — قبل أي انتظار إضافي
            this.recordArtifact(guild.id, executor?.id ?? 'unknown', 'webhooks', webhook.id);
            await webhook.delete('Liberty City — ويب هوك غير مصرح').catch(() => { });
            if (!executor) {
                logger.warn(`🚨 Webhook deleted in ${guild.name} — creator unknown (${webhook.id})`);
                return;
            }
            // 🤖 بوت غير مصرح أو 🧑 إنسان: صفر تسامح — حظر/سحب رولات بالمعرّف
            const isBot = this.executorIsBot(guild, executor);
            const prevent = cfg.mode !== 'react';
            const text = await this.neutralizeById(guild, executor, cfg, 'Liberty City — إنشاء ويب هوك غير مصرح (Anti-Nuke)', isBot || prevent);
            await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
            void this.getAlertChannel(guild, settings, cfg.logChannel)
                .then(ch => ch
                ?.send({
                content: `🚨 **ويب هوك غير مصرح — تم احتواؤه**\n` +
                    `${isBot ? '🤖' : '👤'} ${this.userLabel(executor)} (\`${executor.id}\`)\n` +
                    `🔗 \`${webhook.id}\`\n${text}`,
            })
                .catch(() => { }))
                .catch(() => { });
        }
        catch (error) {
            logger.error(`onWebhookUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Pro Max: ANTI-ROLE ASSIGNMENT — إعطاء رولات → إرجاع فوري + عقوبة
    // --------------------------------------------
    async onGuildMemberUpdate(oldMember, newMember) {
        try {
            if (!newMember?.guild)
                return;
            const guild = newMember.guild;
            const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
            if (addedRoles.size === 0)
                return;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const antiNuke = settings.protection?.antiNuke;
            if (!antiNuke?.enabled)
                return;
            // 🤖 بوت غير مصرح حصل على رولات → تحييد فوري (يمنع بناء ذراع تخريبي)
            if (newMember.user?.bot) {
                const wl = this.botWhitelist(settings);
                if (!wl.has(newMember.id) && this.hasDangerousPermissions(newMember)) {
                    this.startIncident(guild.id, newMember.id);
                    void this.auditDangerousBots(guild).catch(() => { });
                }
                return;
            }
            // ⚡ تحديد المنفّذ من بثّ التدقيق الفوري أولاً (بدون REST بطيء)
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.MemberRoleUpdate, newMember.id, 1500, 10000);
            if (!executor)
                return;
            if (executor.id === this.client.user?.id)
                return;
            if (await this.isTrustedExecutor(guild, executor.id))
                return;
            // 🧑 إنسان: إعطاء رول عادي واحد قد يكون طبيعياً. لا نعاقب إلا إذا كان الرول خطيراً أو 3+ رولات.
            const dangerousRole = addedRoles.some((r) => {
                const p = r.permissions;
                return (p.has(discord_js_1.PermissionFlagsBits.Administrator) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageGuild) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageChannels) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageRoles) ||
                    p.has(discord_js_1.PermissionFlagsBits.ManageWebhooks) ||
                    p.has(discord_js_1.PermissionFlagsBits.BanMembers) ||
                    p.has(discord_js_1.PermissionFlagsBits.KickMembers));
            });
            if (!dangerousRole && addedRoles.size < 3)
                return;
            const me = guild.members.me;
            const canManageRoles = me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles) ?? false;
            let rolesRestored = false;
            if (canManageRoles) {
                try {
                    await newMember.roles.remove(addedRoles, 'Liberty City — استرجاع رولات غير مصرح بها');
                    rolesRestored = true;
                }
                catch { }
            }
            // 🛡️ وضع المنع: إعطاء رول خطير من منفّذ غير موثوق = اعتداء → عقوبة فورية بالمعرّف
            const preventMode = antiNuke.mode !== 'react';
            const punishText = await this.neutralizeById(guild, executor, antiNuke, 'Liberty City Anti-Nuke: إعطاء رولات خطيرة بدون تصريح', preventMode);
            await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
            const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
            const executorType = this.executorIsBot(guild, executor) ? '🤖 بوت' : '👤 عضو';
            alert?.send({
                content: `🎭 **${executorType} أعطى رول خطير:** ${this.userLabel(executor)}\n` +
                    `👤 الهدف: ${newMember.user.tag}\n` +
                    `🔄 استرجاع الرولات: ${rolesRestored ? '✅' : canManageRoles ? '❌' : '⚠️ لا توجد صلاحية ManageRoles'}\n` +
                    `🛡️ ${punishText}`,
            }).catch(() => { });
        }
        catch (error) {
            logger.error(`onGuildMemberUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // PREVENTIVE: ANTI-@EVERYONE DANGEROUS PERMISSIONS
    // يمنع أي تغيير يعطي @everyone صلاحيات: Administrator, ManageChannels, ManageRoles, BanMembers, KickMembers, MentionEveryone
    // --------------------------------------------
    async onChannelPermissionUpdate(oldChannel, newChannel) {
        try {
            if (!newChannel?.guild)
                return;
            // فحص سريع: هل فيه تغيير في أوفررايتس @everyone؟
            const everyoneRoleId = newChannel.guild.id;
            const oldEveryone = oldChannel.permissionOverwrites?.cache?.get(everyoneRoleId);
            const newEveryone = newChannel.permissionOverwrites?.cache?.get(everyoneRoleId);
            if (!newEveryone)
                return; // مفيش أوفررايت على @everyone
            const DANGEROUS_PERMS = [
                discord_js_1.PermissionFlagsBits.Administrator,
                discord_js_1.PermissionFlagsBits.ManageChannels,
                discord_js_1.PermissionFlagsBits.ManageRoles,
                discord_js_1.PermissionFlagsBits.BanMembers,
                discord_js_1.PermissionFlagsBits.KickMembers,
                discord_js_1.PermissionFlagsBits.MentionEveryone,
                discord_js_1.PermissionFlagsBits.ManageWebhooks,
                discord_js_1.PermissionFlagsBits.ManageGuild,
            ];
            const newAllow = newEveryone.allow?.bitfield ?? 0n;
            const oldAllow = oldEveryone?.allow?.bitfield ?? 0n;
            let dangerousAdded = false;
            for (const perm of DANGEROUS_PERMS) {
                const permBit = BigInt(perm);
                if ((newAllow & permBit) !== 0n && (oldAllow & permBit) === 0n) {
                    dangerousAdded = true;
                    break;
                }
            }
            if (!dangerousAdded)
                return; // مفيش صلاحيات خطيرة جديدة
            const guild = newChannel.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const antiNuke = settings.protection?.antiNuke;
            if (!antiNuke?.enabled)
                return; // احترام الإطفاء قبل أي طلب
            // ⚡ بثّ التدقيق أولاً — بدون اشتراط وجود العضو في الكاش أو فحص الهرمية
            const entry = await this.findAuditEntry(guild, discord_js_1.AuditLogEvent.ChannelUpdate, newChannel.id, 1500, 6000);
            if (!entry?.executor)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (await this.isTrustedExecutor(guild, entry.executor.id))
                return;
            const me = guild.members.me;
            const canManageChannels = me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels) ?? false;
            // 1️⃣ إرجاع الأوفررايت فوراً
            let permsRestored = false;
            if (canManageChannels && oldEveryone) {
                try {
                    await newChannel.permissionOverwrites.edit(everyoneRoleId, oldEveryone, 'Liberty City — استرجاع صلاحيات @everyone');
                    permsRestored = true;
                }
                catch (e) {
                    logger.warn(`Failed to restore @everyone perms in ${guild.name}: ${e.message}`);
                }
            }
            // 2️⃣ العقوبة — حظر فوري بالمعرّف (ولو فشل: سحب كل الرولات)
            const isBot = this.executorIsBot(guild, entry.executor);
            const prevent = antiNuke.mode !== 'react';
            const text = await this.neutralizeById(guild, entry.executor, antiNuke, 'Liberty City — منح @everyone صلاحيات خطيرة (Anti-Nuke)', isBot || prevent);
            // 3️⃣ تنبيه أحمر
            const alert = await this.getAlertChannel(guild, settings, antiNuke.logChannel);
            const executorType = isBot ? '🤖 بوت' : '👤 عضو';
            alert?.send({
                content: `🚨 **${executorType} حاول إعطاء @everyone صلاحيات خطيرة!**\n` +
                    `👤 المنفّذ: ${entry.executor.tag}\n` +
                    `📍 القناة: <#${newChannel.id}>\n` +
                    `🔄 استرجاع الصلاحيات: ${permsRestored ? '✅ تم' : '❌ فشل'}\n` +
                    `🛡️ ${text}`,
            }).catch(() => { });
            logger.error(`🚨 ANTI-@EVERYONE triggered in ${guild.name} by ${entry.executor.tag} on #${newChannel.name}`);
        }
        catch (error) {
            logger.error(`onChannelPermissionUpdate (@everyone) error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // PREVENTIVE: BOT JOIN FILTER — يمنع بوتات مش موثوقة
    // --------------------------------------------
    async onGuildMemberAdd(member) {
        try {
            if (!member?.guild || !member.user?.bot)
                return;
            await this.guardBotJoin(member.guild, member.id, member);
        }
        catch (error) {
            logger.error(`onGuildMemberAdd (anti-bot) error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // PREVENTIVE: NUKE DETECTION — كشف عمليات جماعية
    // --------------------------------------------
    trackNukeActivity(guildId, type) {
        const now = Date.now();
        const tracker = this.nukeTracker.get(guildId) || { channels: 0, roles: 0, webhooks: 0, lastAction: now };
        // Reset إذا مرت 10 ثواني
        if (now - tracker.lastAction > 10000) {
            tracker.channels = 0;
            tracker.roles = 0;
            tracker.webhooks = 0;
        }
        // زيادة العداد الصحيح
        if (type === 'channel')
            tracker.channels++;
        else if (type === 'role')
            tracker.roles++;
        else if (type === 'webhook')
            tracker.webhooks++;
        tracker.lastAction = now;
        this.nukeTracker.set(guildId, tracker);
        // كشف نكهة: 3+ قنوات أو 3+ رولات أو 2+ ويب هوك في 10 ثواني
        return tracker.channels >= 3 || tracker.roles >= 3 || tracker.webhooks >= 2;
    }
    // إضافة tracking في onChannelCreate
    // إضافة tracking في onRoleCreate
    // إضافة tracking في onWebhookUpdate
    // --------------------------------------------
    // Pro Max: STICKY BOT ROLE POSITION — كل 10 ثواني يتأكد إن رول البوت في القمة
    // --------------------------------------------
    startStickyRoleWatchdog(guild) {
        if (this.topWatchdogs?.has?.(guild.id))
            return;
        const check = async () => {
            try {
                const settings = await (0, models_1.getGuildSettings)(guild.id);
                if (!settings.protection?.antiNuke?.enabled)
                    return;
                const me = guild.members.me;
                if (!me)
                    return;
                const botRole = me.roles.highest;
                const rolesArray = Array.from(guild.roles.cache.values());
                const highestUserRole = rolesArray
                    .filter(r => !r.managed && r.id !== guild.id)
                    .sort((a, b) => b.position - a.position)[0];
                if (highestUserRole && botRole.position <= highestUserRole.position) {
                    try {
                        // 🔕 صامت تماماً — لا رسائل تلقائية، الرفع فقط
                        //    (الحالة تُفحص يدوياً عبر /protection hierarchy)
                        await botRole.setPosition(highestUserRole.position + 1, { reason: 'Security: sticky top position' });
                    }
                    catch { }
                }
            }
            catch { }
        };
        check();
        const timer = setInterval(check, 10000); // every 10 seconds
        if (!this.topWatchdogs)
            this.topWatchdogs = new Map();
        this.topWatchdogs.set(guild.id, timer);
    }
    // --------------------------------------------
    // Pro Max: ANTI-EMOJI/STICKER DELETE SPAM
    // --------------------------------------------
    async onGuildEmojiDelete(emoji) {
        await this.handleMassDelete(emoji.guild, 'emoji', discord_js_1.AuditLogEvent.EmojiDelete, emoji.id);
    }
    async onGuildStickerDelete(sticker) {
        await this.handleMassDelete(sticker.guild, 'sticker', discord_js_1.AuditLogEvent.StickerDelete, sticker.id);
    }
    // --------------------------------------------
    // Pro Max: ANTI-MASS-MESSAGE-DELETE — كشف الحذف الجماعي للرسائل + استعادة فورية
    // --------------------------------------------
    async onMessageDeleteBulk(messages) {
        try {
            if (!messages?.size || !messages.first()?.guild)
                return;
            const guild = messages.first().guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            const channel = messages.first().channel;
            if (!channel || channel.type !== 0)
                return; // فقط القنوات النصية
            // تتبّع الحذف الجماعي
            const tracker = this.getMessageDeletionTracker(guild.id);
            const now = Date.now();
            if (!tracker[channel.id])
                tracker[channel.id] = [];
            tracker[channel.id].push(now);
            // نافذة 5 ثواني
            tracker[channel.id] = tracker[channel.id].filter(t => now - t <= 5000);
            const count = tracker[channel.id].length;
            const threshold = Math.max(cfg.threshold ?? 3, 10); // عتبة أعلى للرسائل (10+ رسالة في 5 ثواني)
            if (count < threshold)
                return;
            // تجاوز العتبة — هجوم حذف جماعي
            tracker[channel.id] = [];
            // معرفة المنفّذ
            const executor = await this.findExecutor(guild, 'MessageDeleteBulk', channel.id);
            const isWhitelisted = executor ? await this.isWhitelisted(guild, executor.id) : false;
            // 🔒 قفل القناة فوراً لمنع المزيد من الحذف
            const everyoneRole = guild.roles.everyone;
            try {
                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false, AddReactions: false }, 'Security: mass message delete detected').catch(() => { });
            }
            catch { }
            // استعادة الرسائل من اللقطة
            let restored = 0;
            const snapshot = this.getMessageSnapshot(guild.id, channel.id);
            if (snapshot && snapshot.messages.length > 0) {
                for (const msg of snapshot.messages.slice(-50)) { // آخر 50 رسالة
                    try {
                        if (msg.content || msg.attachments.length > 0 || msg.embeds.length > 0) {
                            await channel.send({
                                content: msg.content || '📎 مرفق/إمبد',
                                files: msg.attachments.map((a) => ({ attachment: a.url, name: a.name })),
                                embeds: msg.embeds,
                            }).catch(() => { });
                            restored++;
                            await sleep(200);
                        }
                    }
                    catch { }
                }
            }
            // عقوبة المنفّذ
            let actionText = '⚠️ تعذّر تحديد المنفّذ';
            if (executor) {
                actionText = await this.punish(guild, executor, cfg.action ?? 'ban', `Liberty City Anti-Nuke: حذف جماعي للرسائل (${messages.size} رسالة)`);
            }
            // تنبيه
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🚨 تحذير أمني — حذف جماعي للرسائل!')
                .setDescription(`تم حذف **${messages.size} رسالة** في ${channel} خلال ثوانٍ — تم قفل القناة واستعادة ما أمكن.`)
                .setColor(embeds_1.Colors.error)
                .addFields({ name: 'المخالف', value: executor ? `${executor} (\`${this.userLabel(executor)}\`)${isWhitelisted ? ' 👑' : ''}` : 'غير معروف', inline: true }, { name: 'الإجراء', value: actionText, inline: true }, { name: '📬 استعادة', value: `أعيد إرسال **${restored}** رسالة`, inline: true })
                .setFooter({ text: 'Liberty City Anti-Nuke' })
                .setTimestamp();
            const alert = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
            if (alert) {
                await alert.send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined }).catch(() => { });
            }
            logger.warn(`🚨 Anti-Nuke: Mass message delete in ${guild.name} (${channel.name}) | executor=${executor?.tag ?? 'unknown'}`);
        }
        catch (error) {
            logger.error(`onMessageDeleteBulk error: ${error.message}`);
        }
    }
    // لقطة رسائل دورية للاستعادة
    messageSnapshotInterval = new Map();
    startMessageSnapshotter(guild) {
        if (this.messageSnapshotInterval.has(guild.id))
            return;
        const interval = setInterval(() => this.captureMessageSnapshots(guild), 30000); // كل 30 ثانية
        this.messageSnapshotInterval.set(guild.id, interval);
    }
    async captureMessageSnapshots(guild) {
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            for (const [, channel] of guild.channels.cache) {
                if (channel.type !== 0)
                    continue; // نصية فقط
                const me = guild.members.me;
                if (!me || !channel.permissionsFor(me)?.has('ReadMessageHistory'))
                    continue;
                const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
                if (!messages?.size)
                    continue;
                const snapshot = {
                    channelId: channel.id,
                    messages: messages.map(m => ({
                        id: m.id,
                        content: m.content,
                        authorId: m.author.id,
                        authorTag: m.author.tag,
                        attachments: m.attachments.map(a => ({ url: a.url, name: a.name })),
                        embeds: m.embeds,
                        timestamp: m.createdTimestamp,
                    })).reverse(), // الأقدم أولاً
                    at: Date.now(),
                };
                this.setMessageSnapshot(guild.id, channel.id, snapshot);
            }
        }
        catch (error) {
            logger.warn(`captureMessageSnapshots failed in ${guild.name}: ${error.message}`);
        }
    }
    getMessageDeletionTracker(guildId) {
        let tracker = this.messageDeletionTracker.get(guildId);
        if (!tracker) {
            tracker = {};
            this.messageDeletionTracker.set(guildId, tracker);
        }
        return tracker;
    }
    getMessageSnapshot(guildId, channelId) {
        const channels = this.messageSnapshots.get(guildId);
        if (!channels)
            return null;
        return channels.get(channelId) ?? null;
    }
    setMessageSnapshot(guildId, channelId, snapshot) {
        let channels = this.messageSnapshots.get(guildId);
        if (!channels) {
            channels = new Map();
            this.messageSnapshots.set(guildId, channels);
        }
        channels.set(channelId, snapshot);
    }
    async handleMassDelete(guild, type, auditType, targetId) {
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            const count = this.track(guild.id, type, cfg.timeWindow ?? 10000);
            if (count < (cfg.threshold ?? 3))
                return;
            this.deletionTracker.get(guild.id)[type] = [];
            await this.respondMassDeletion(guild, settings, cfg, type, auditType, targetId);
        }
        catch (error) {
            logger.error(`handleMassDelete error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Pro Max: ANTI-THREAD CREATE SPAM (ماعدا الأونر)
    // --------------------------------------------
    async onThreadCreate(thread) {
        try {
            if (!thread?.guild)
                return;
            const guild = thread.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return; // احترام الإطفاء
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.ThreadCreate, thread.id, 1500, 15000);
            if (!executor)
                return;
            if (executor.id === this.client.user?.id)
                return;
            if (await this.isTrustedExecutor(guild, executor.id))
                return;
            // أي بوت غير مصرح ينشئ ثريد → حظر فوري + حذف
            if (this.executorIsBot(guild, executor)) {
                try {
                    await thread.delete('Liberty City — بوت غير مصرح أنشأ ثريد');
                }
                catch { }
                const prevent = cfg.mode !== 'react';
                const action = prevent ? 'ban' : (cfg.action ?? 'kick');
                const text = await this.punishById(guild, executor, action, 'Liberty City — بوت أنشأ ثريد (Anti-Nuke)');
                await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
                void this.getAlertChannel(guild, settings, cfg.logChannel)
                    .then(ch => ch
                    ?.send({ content: `🧵 **بوت حاول إنشاء ثريد:** ${this.userLabel(executor)} — ${text}` })
                    .catch(() => { }))
                    .catch(() => { });
                return;
            }
            // 🧑 إنسان: انفجار ثريدات (3+ خلال 10 ثوانٍ) = هجوم
            const burst = this.trackCreateOnce(guild.id, executor.id, 'thread', thread.id, 10000);
            if (burst < 3)
                return;
            this.startIncident(guild.id, executor.id);
            try {
                await thread.delete('Liberty City — إنشاء ثريدات جماعي');
            }
            catch { }
            const prevent = cfg.mode !== 'react';
            const action = prevent ? 'ban' : (cfg.action ?? 'kick');
            const text = await this.punishById(guild, executor, action, 'Liberty City — إنشاء ثريدات جماعي');
            await this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
            void this.getAlertChannel(guild, settings, cfg.logChannel)
                .then(ch => ch
                ?.send({ content: `🧵 **هجوم ثريدات:** ${this.userLabel(executor)} أنشأ ${burst} ثريدات — ${text}` })
                .catch(() => { }))
                .catch(() => { });
        }
        catch (error) {
            logger.error(`onThreadCreate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 1) ANTI-NUKE: كشف الحذف الجماعي
    // --------------------------------------------
    async onChannelDelete(channel) {
        try {
            if (!channel?.guild)
                return;
            const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            const count = this.track(channel.guild.id, 'channel', cfg.timeWindow ?? 10000);
            // ⚡ استجابة فورية من أول حذف — "مايقدر اساسا يحذف قنوات" (العتبة القديمة3/10ث كانت تسمح بحذفين بلا رد)
            if (count < 1)
                return;
            this.deletionTracker.get(channel.guild.id).channel = [];
            await this.respondMassDeletion(channel.guild, settings, cfg, 'channel', discord_js_1.AuditLogEvent.ChannelDelete, channel.id);
        }
        catch (error) {
            logger.error(`onChannelDelete error: ${error.message}`);
        }
    }
    async onRoleDelete(role) {
        try {
            if (!role?.guild || role.id === role.guild.id)
                return;
            const settings = await (0, models_1.getGuildSettings)(role.guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            const count = this.track(role.guild.id, 'role', cfg.timeWindow ?? 10000);
            // ⚡ استجابة فورية من أول حذف رول
            if (count < 1)
                return;
            this.deletionTracker.get(role.guild.id).role = [];
            await this.respondMassDeletion(role.guild, settings, cfg, 'role', discord_js_1.AuditLogEvent.RoleDelete, role.id);
        }
        catch (error) {
            logger.error(`onRoleDelete error: ${error.message}`);
        }
    }
    async onBanAdd(ban) {
        try {
            if (!ban?.guild)
                return;
            const settings = await (0, models_1.getGuildSettings)(ban.guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            const count = this.track(ban.guild.id, 'ban', cfg.timeWindow ?? 10000);
            // ⚡ استجابة فورية من أول حظر — يُلغي حظر الضحية ويعاقب المنفّذ
            if (count < 1)
                return;
            this.deletionTracker.get(ban.guild.id).ban = [];
            await this.respondMassDeletion(ban.guild, settings, cfg, 'ban', discord_js_1.AuditLogEvent.MemberBanAdd, ban.user?.id);
        }
        catch (error) {
            logger.error(`onBanAdd error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 1b) ANTI-KICK: رصد الطرد الجماعي + استعادة المطرودين
    // --------------------------------------------
    // 🔴 الثغرة التي حدثت فعلاً: مضاد النيوك كان يراقب القنوات والرولات والحظر
    //    **ولا يراقب الطرد إطلاقاً** → ٧٥ طرد في ثوانٍ = صفر استجابة.
    //
    // وديسكورد **ما فيها أمر "إلغاء طرد"** — المطرود يرجع بالرابط فقط،
    // فالمستعادة الوحيدة الممكنة هي إرسال رابط الدعوة للمطرودين.
    async onMemberKick(member) {
        try {
            if (!member?.guild || member.user.bot)
                return;
            const settings = await (0, models_1.getGuildSettings)(member.guild.id);
            const cfg = settings.protection?.antiNuke;
            if (!cfg?.enabled)
                return;
            // نميّز الطرد عن الاستقالة الطوعية عبر سجلات التدقيق
            const executor = await this.findKickExecutor(member.guild, member.id);
            if (!executor)
                return; // استقالة عادية → لا نتدخل
            if (executor.id === this.client.user?.id)
                return; // طرد شرعي من البوت نفسه
            if (await this.isTrustedExecutor(member.guild, executor.id))
                return; // مالك/مطوّر فقط
            // نحتفظ بالمطرود ليرسل له رابط الدعوة (استعادة تلقائية)
            const queue = this.kickedQueue.get(member.guild.id) ?? [];
            if (!queue.some(e => e.userId === member.id)) {
                queue.push({ userId: member.id, tag: member.user.tag, at: Date.now() });
                this.kickedQueue.set(member.guild.id, queue);
                this.scheduleKickedRecovery(member.guild, settings);
            }
            // تتبّع العتبة — استجابة فورية من أول طرد (لا عتبة)
            const count = this.track(member.guild.id, 'kick', cfg.timeWindow ?? 10000);
            if (count < 1)
                return;
            this.deletionTracker.get(member.guild.id).kick = [];
            await this.respondMassDeletion(member.guild, settings, cfg, 'kick', discord_js_1.AuditLogEvent.MemberKick, member.id);
        }
        catch (error) {
            logger.error(`onMemberKick error: ${error.message}`);
        }
    }
    // يجمّع عدة طرود في محاولة استعادة واحدة (مؤجّل ٦ ثوانٍ)
    scheduleKickedRecovery(guild, settings) {
        if (settings?.protection?.antiNuke?.autoDmRecovery === false)
            return;
        const existing = this.kickedTimers.get(guild.id);
        if (existing)
            clearTimeout(existing);
        const timer = setTimeout(() => {
            this.kickedTimers.delete(guild.id);
            this.flushKickedRecovery(guild).catch(() => { });
        }, 6000);
        this.kickedTimers.set(guild.id, timer);
    }
    // يرسل رابط الدعوة لكل المطرودين المجمّعين ثم يفرّغ القائمة
    async flushKickedRecovery(guild) {
        const queue = this.kickedQueue.get(guild.id) ?? [];
        if (!queue.length)
            return;
        this.kickedQueue.set(guild.id, []);
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const invite = await this.getInviteLink(guild);
            if (!invite) {
                logger.warn(`👢 استعادة الطرد في ${guild.name}: لا يوجد رابط دعوة`);
                return;
            }
            let sent = 0;
            for (const e of queue) {
                if (await this.dmInvite(guild, e.userId, invite))
                    sent++;
                await sleep(1500);
            }
            const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
            if (channel) {
                await channel
                    .send({
                    embeds: [
                        new discord_js_1.EmbedBuilder()
                            .setTitle('👢 استعادة المطرودين — اكتملت')
                            .setDescription(`أُرسل رابط الدعوة إلى **${sent}/${queue.length}** عضو مطرود.\n` +
                            '**مهم:** ديسكورد ما فيها "إلغاء طرد" — المطرود **يرجع بنفسه** من الرابط.')
                            .setColor(sent > 0 ? embeds_1.Colors.success : embeds_1.Colors.warning)
                            .addFields({ name: '📨 وصلت الرسالة', value: `${sent}`, inline: true }, { name: '⛔ لم تصل', value: `${queue.length - sent}`, inline: true }, { name: '🔗 الرابط', value: invite, inline: false })
                            .setFooter({ text: 'Liberty City — Kick Recovery' })
                            .setTimestamp(),
                    ],
                })
                    .catch(() => { });
            }
            logger.info(`👢 استعادة الطرد في ${guild.name}: ${sent}/${queue.length} رسالة`);
        }
        catch (error) {
            logger.error(`flushKickedRecovery error: ${error.message}`);
        }
    }
    /**
     * 👢 استعادة المطرودين يدوياً — يقرأ سجلات التدقيق ويرسل لكل مطرود رابط الدعوة
     * (للاستعادة بعد هجوم وقع بالفعل — لا يمكن إلغاء الطرد في ديسكورد)
     */
    async recoverKickedFromAudit(guild, limit) {
        const invite = await this.getInviteLink(guild);
        if (!invite)
            return { total: 0, sent: 0, failed: 0, invite: null };
        // نقرأ سجلات التدقيق على دفعات حتى نغطّي `limit`
        const kickedIds = [];
        let before;
        while (kickedIds.length < limit) {
            let logs;
            try {
                logs = await guild.fetchAuditLogs({
                    type: discord_js_1.AuditLogEvent.MemberKick,
                    limit: 100,
                    ...(before ? { before } : {}),
                });
            }
            catch {
                break;
            }
            const entries = [...logs.entries.values()];
            if (!entries.length)
                break;
            for (const e of entries) {
                if (e.targetId && !kickedIds.includes(e.targetId))
                    kickedIds.push(e.targetId);
                if (kickedIds.length >= limit)
                    break;
            }
            if (entries.length < 100)
                break;
            before = entries[entries.length - 1].id;
            await sleep(400);
        }
        let sent = 0;
        let failed = 0;
        for (const userId of kickedIds) {
            if (await this.dmInvite(guild, userId, invite))
                sent++;
            else
                failed++;
            await sleep(1500);
        }
        return { total: kickedIds.length, sent, failed, invite };
    }
    /** يرسل رسالة خاصة برابط الدعوة — يعيد true لو وصلت */
    async dmInvite(guild, userId, invite) {
        try {
            const user = await this.client.users.fetch(userId);
            if (user.bot)
                return false;
            await user.send(`👋 مرحباً ${user.username}\n` +
                `انتطردت من **${guild.name}** — غالباً بالخطأ.\n` +
                `تقدر ترجع الحين من هنا:\n${invite}`);
            return true;
        }
        catch {
            return false; // الخصوصية مغلقة أو الحساب غير موجود
        }
    }
    /** رابط دعوة دائم — يستخدم الموجود أو ينشئ واحداً جديداً */
    async getInviteLink(guild) {
        try {
            const existing = await guild.invites.fetch();
            const first = existing.first();
            if (first)
                return `https://discord.gg/${first.code}`;
        }
        catch {
            /* لا صلاحية أو لا توجد دعوات محفوظة */
        }
        try {
            const me = guild.members.me;
            const channel = guild.channels.cache.find((c) => c.type === discord_js_1.ChannelType.GuildText &&
                !!me &&
                !!c.permissionsFor(me)?.has(discord_js_1.PermissionFlagsBits.CreateInstantInvite));
            if (!channel)
                return null;
            const inv = await channel.createInvite({
                maxAge: 0,
                maxUses: 0,
                unique: false,
                reason: 'Liberty City — استعادة الأعضاء المطرودين',
            });
            return `https://discord.gg/${inv.code}`;
        }
        catch (error) {
            logger.warn(`getInviteLink failed in ${guild.name}: ${error.message}`);
            return null;
        }
    }
    async respondMassDeletion(guild, settings, cfg, type, auditType, targetId) {
        const labels = {
            channel: { emoji: '📢', label: 'قنوات' },
            role: { emoji: '🎭', label: 'رولات' },
            ban: { emoji: '🔨', label: 'حظر جماعي' },
            kick: { emoji: '👢', label: 'طرد جماعي' },
        };
        const executor = await this.findExecutor(guild, auditType, targetId, 1500, 15000);
        const windowSec = Math.round((cfg.timeWindow ?? 10000) / 1000);
        // ⏱ استجابة فورية — لكن صامتة لو المنفّذ هو البوت نفسه
        if (executor && executor.id === this.client.user?.id) {
            logger.info(`⏭️ Anti-Nuke: تخطّي — المنفّذ هو البوت نفسه (${type} في ${guild.name})`);
            return;
        }
        // 👑 ثقة: المالك + مطوّر البوت فقط
        const trusted = executor ? await this.isTrustedExecutor(guild, executor.id) : false;
        // تصرفات المالك/المطوّر شرعية — لا عقوبة ولا استعادة ولا تنبيه
        if (executor && trusted)
            return;
        // 🔨 الحظر/الطرد: عملية واحدة قد تكون مشروعة — 2+ خلال 10 ثوانٍ = هجوم
        if ((type === 'ban' || type === 'kick') && executor) {
            const count = this.trackActionOnce(guild.id, executor.id, type, targetId, 10000);
            if (count < 2)
                return;
        }
        // 🔨 الحظر يُلغى فوراً عن الضحية — بالتوازي مع كل شيء
        void (type === 'ban' && targetId && executor && !trusted
            ? guild.members.unban(targetId, 'Liberty City Anti-Nuke: إلغاء حظر الضحية تلقائياً').catch(() => { })
            : Promise.resolve());
        // 🛡️ وضع المنع الوقائي: أول عملية اعتداء = حظر فوري
        const preventMode = cfg.mode !== 'react';
        const effectiveAction = preventMode ? 'ban' : (cfg.action ?? 'kick');
        // ♻️ الاستعادة تبدأ الآن فوراً — بالتوازي مع العقوبة والتنبيه (لا ننتظر شيئاً)
        const restoreP = (type === 'channel' || type === 'role') && cfg.autoRestore !== false && !trusted
            ? this.runAutoRestore(guild, settings, type)
                .then(() => this.cleanupSuspicious(guild).catch(() => { }))
                .catch((err) => logger.error(`runAutoRestore failed: ${err?.message ?? err}`))
            : Promise.resolve();
        let actionText;
        let punishP = Promise.resolve('');
        let purgeP = Promise.resolve(0);
        if (!executor) {
            actionText = '⚠️ تعذّر تحديد المنفّذ من سجلات التدقيق';
        }
        else if (trusted) {
            actionText = '⏭️ المنفّذ موثوق (مالك/مطوّر) — لا عقوبة';
        }
        else {
            // 🚨 حادث نشط — يمنع أي إنشاء جديد من نفس المهاجم فوراً
            this.startIncident(guild.id, executor.id);
            const reason = `Liberty City Anti-Nuke: ${labels[type].label} — ردّ فوري${preventMode ? ' (وضع المنع)' : ''}`;
            // ⚡ عقوبة بالمعرّف مباشرة — أسرع مسار ممكن (بدون جلب عضو أو سحب رولات متسلسل)
            punishP = this.punishById(guild, executor, effectiveAction, reason);
            // 🧹 حذف كل ما أنشأه المهاجم (قنوات/رولات/ويب هوكس) — بالتوازي
            purgeP = this.purgeAttackerArtifacts(guild, executor.id).catch(() => 0);
            actionText = preventMode ? '🛡️ وضع المنع: تحييد فوري جارٍ…' : '⏳ تنفيذ العقوبة…';
        }
        // ننتظر العقوبة فقط (سريعة) — الاستعادة والتطهير يكملان بالخلفية
        if (executor && !trusted) {
            const punishResult = await punishP.catch((err) => `⚠️ ${err?.message ?? 'فشل'}`);
            if (punishResult)
                actionText = preventMode ? `🛡️ **وضع المنع** — ${punishResult}` : punishResult;
            void purgeP.then(n => {
                if (n > 0)
                    logger.info(`🧹 Anti-Nuke purge: حُذف ${n} من آثار ${this.userLabel(executor)} في ${guild.name}`);
            });
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(preventMode ? `🚨 تحذير أمني — وضع المنع الوقائي` : `🚨 تحذير أمني — استجابة فورية`)
            .setDescription(`${labels[type].emoji} تنفيذ عملية **${labels[type].label}** — ردّ أمني **فوري من أول عملية** (نافذة الرصد ${windowSec}ث) — نمط هجوم "نيوك"!`)
            .setColor(embeds_1.Colors.error)
            .addFields({ name: 'المخالف', value: executor ? `${executor} (\`${this.userLabel(executor)}\`)${trusted ? ' 👑' : ''}` : 'غير معروف', inline: true }, { name: 'الإجراء المتخذ', value: actionText, inline: true }, {
            name: '♻️ التعافي',
            value: type === 'ban'
                ? '🔨 تم **إلغاء حظر الضحية** تلقائياً (إن أمكن)'
                : type === 'kick'
                    ? '👢 سيتم إرسال **رابط الدعوة** للمطرودين تلقائياً (يرجعون بأنفسهم)'
                    : trusted
                        ? '⏭️ المنفّذ موثوق — تم تخطّي الاستعادة'
                        : cfg.autoRestore === false
                            ? 'الاستعادة التلقائية **مطفأة** — استخدم `/backup restore` يدوياً لاستعادة البنية'
                            : '♻️ **جارية الآن:** استعادة فورية من آخر نسخة احتياطية…',
            inline: false,
        })
            .setFooter({ text: 'Liberty City Anti-Nuke' })
            .setTimestamp();
        // ♻️ الاستعادة انطلقت مسبقاً بالتوازي (لا ننتظرها هنا حتى لا نبطئ بقية الأحداث)
        const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
        if (channel) {
            void channel
                .send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined })
                .catch(() => { });
        }
        logger.warn(`🚨 Anti-Nuke (فوري): ${type} في ${guild.name} | executor=${executor?.tag ?? 'unknown'} | ${actionText}`);
        void restoreP;
    }
    // (تمت إزالة سطر مستوى التسلّم — البوت صامت تماماً ولا يرسل رسائل عن الرولات الأعلى)
    // ♻️ الاستعادة التلقائية — تعيد القنوات والرولات المفقودة من آخر نسخة احتياطية
    async runAutoRestore(guild, settings, type) {
        const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
        try {
            const result = await this.restoreBackup(guild);
            const nothing = result.channels === 0 && result.roles === 0;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(nothing ? '♻️ الاستعادة التلقائية — لا يوجد شيء ناقص' : '♻️ الاستعادة التلقائية اكتملت')
                .setDescription(nothing
                ? 'كل البنية المحفوظة موجودة أصلاً — لا حاجة لإعادة إنشاء شيء.'
                : 'أُعيدت بنية السيرفر من آخر نسخة احتياطية تلقائياً بعد هجوم الحذف المكثف.')
                .setColor(nothing ? embeds_1.Colors.warning : embeds_1.Colors.success)
                .addFields({ name: '📢 قنوات', value: `+${result.channels}`, inline: true }, { name: '🎭 رولات', value: `+${result.roles}`, inline: true }, { name: '⏭️ مُتجاوَز', value: `${result.skipped}`, inline: true })
                .setFooter({ text: 'Liberty City — Auto Restore' })
                .setTimestamp();
            if (channel)
                await channel.send({ embeds: [embed] }).catch(() => { });
            logger.info(`♻️ Auto-restore ${guild.name} (${type}): +${result.channels} قناة، +${result.roles} رولة`);
        }
        catch (error) {
            logger.warn(`Auto-restore failed in ${guild.name}: ${error.message}`);
            if (channel) {
                await channel
                    .send({
                    embeds: [
                        new discord_js_1.EmbedBuilder()
                            .setTitle('⚠️ فشلت الاستعادة التلقائية')
                            .setDescription(`**السبب:** ${error.message}\nجرّب يدوياً: \`/backup restore\``)
                            .setColor(embeds_1.Colors.warning)
                            .setFooter({ text: 'Liberty City — Auto Restore' })
                            .setTimestamp(),
                    ],
                })
                    .catch(() => { });
            }
        }
    }
    // --------------------------------------------
    // 2) ANTI-BOT: طرد بوت غير مصرح به
    // --------------------------------------------
    // يعيد true إذا تم طرد العضو (لتخطي الترحيب)
    async onMemberJoin(member) {
        try {
            if (!member.user.bot)
                return false;
            // 🛡️ منع فوري بالمعرّف (حظر) وليس مجرد طرد — لا يمكنه العودة
            return await this.guardBotJoin(member.guild, member.user.id, member);
        }
        catch (error) {
            logger.error(`onMemberJoin error: ${error.message}`);
            return false;
        }
    }
    // --------------------------------------------
    // 3) ANTI-ADMIN: منح صلاحية Administrator
    // --------------------------------------------
    // 🚨 خُفّضت رتبة البوت — تسجيل داخلي صامت فقط (بدون أي رسالة Discord)
    async announceBotDemotion(guild, oldRole, newRole) {
        this.hierarchyState.set(guild.id, false);
        try {
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.RoleUpdate, newRole.id);
            logger.error(`🚨🚨 Bot demoted in ${guild.name}: #${oldRole.position} → #${newRole.position} | executor=${executor?.tag ?? 'unknown'}`);
        }
        catch (error) {
            logger.error(`announceBotDemotion error: ${error.message}`);
        }
    }
    async onRoleUpdate(oldRole, newRole) {
        try {
            if (!newRole.guild)
                return;
            // 🚨 أخطر هجوم صامت: خفض رتبة البوت — يعطّل كل الحماية دفعة واحدة
            const me = newRole.guild.members.me;
            if (me &&
                me.roles.cache.has(newRole.id) &&
                newRole.position < oldRole.position &&
                !this.checkHierarchy(newRole.guild).ok) {
                await this.announceBotDemotion(newRole.guild, oldRole, newRole);
            }
            const guild = newRole.guild;
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const gainedAdmin = !oldRole.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) &&
                newRole.permissions.has(discord_js_1.PermissionFlagsBits.Administrator);
            const antiAdminCfg = settings.protection?.antiAdmin;
            const nukeCfg = settings.protection?.antiNuke;
            // 🛡️ حاجز الصلاحيات — وضع المنع الوقائي: يمنع الهكر من بناء ذراعه من الأساس
            //    أي رول يكتسب صلاحية "نيوك" (إدارة/حظر/طرد/ويبهوك/منشن الجميع/مدير) من منفّذ غير موثوق
            //    → إرجاع الصلاحيات القديمة فوراً + حجر المهاجم + عقوبة
            const permNames = new Map([
                [discord_js_1.PermissionFlagsBits.Administrator, 'المدير العام'],
                [discord_js_1.PermissionFlagsBits.ManageGuild, 'إدارة السيرفر'],
                [discord_js_1.PermissionFlagsBits.ManageChannels, 'إدارة القنوات'],
                [discord_js_1.PermissionFlagsBits.ManageRoles, 'إدارة الرولات'],
                [discord_js_1.PermissionFlagsBits.ManageWebhooks, 'إدارة الويبهوكس'],
                [discord_js_1.PermissionFlagsBits.BanMembers, 'حظر الأعضاء'],
                [discord_js_1.PermissionFlagsBits.KickMembers, 'طرد الأعضاء'],
                [discord_js_1.PermissionFlagsBits.MentionEveryone, 'منشن الجميع'],
            ]);
            const DANGEROUS = [...permNames.keys()];
            const deferToAntiAdmin = gainedAdmin && !!antiAdminCfg?.enabled;
            const gainedDangerous = nukeCfg?.enabled
                ? DANGEROUS.filter((p) => {
                    if (p === discord_js_1.PermissionFlagsBits.Administrator && deferToAntiAdmin)
                        return false; // antiAdmin يتكفل بها بالأسفل
                    return !oldRole.permissions.has(p) && newRole.permissions.has(p);
                })
                : [];
            if (!gainedAdmin && gainedDangerous.length === 0)
                return;
            if (gainedDangerous.length > 0) {
                const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.RoleUpdate, newRole.id);
                if (executor &&
                    executor.id !== this.client.user?.id &&
                    !(await this.isTrustedExecutor(guild, executor.id))) {
                    const preventMode = nukeCfg?.mode !== 'react';
                    // 1️⃣ إرجاع الصلاحيات القديمة فوراً — استدعاء واحد يلغي كل المكاسب (مدير/إدارة/حظر…)
                    let reverted = false;
                    try {
                        await newRole.setPermissions(oldRole.permissions, 'Liberty City Permission Guard: dangerous permissions reverted');
                        reverted = true;
                    }
                    catch (e) {
                        logger.warn(`Permission guard: revert failed in ${guild.name}: ${e.message}`);
                    }
                    // 2️⃣ العقوبة — وضع المنع: حجر الصلاحيات ثم حظر فوري
                    let punishText = 'تنبيه فقط';
                    const executorMember = guild.members.cache.get(executor.id);
                    if (executorMember && preventMode) {
                        await executorMember.roles
                            .set([], 'Liberty City Anti-Nuke: وضع المنع — حجر الصلاحيات')
                            .catch(() => { });
                    }
                    if (executorMember) {
                        const act = preventMode
                            ? 'ban'
                            : (nukeCfg?.action ?? 'kick');
                        punishText = await this.punish(guild, executor, act, 'Liberty City Permission Guard: منح صلاحيات خطيرة (حاجز الصلاحيات)');
                    }
                    // 3️⃣ تقرير أمني
                    const names = gainedDangerous
                        .map((p) => permNames.get(p) ?? 'صلاحية خطيرة')
                        .join('، ');
                    const alert = await this.getAlertChannel(guild, settings, nukeCfg?.logChannel);
                    alert?.send({
                        embeds: [
                            new discord_js_1.EmbedBuilder()
                                .setTitle('🛡️ حاجز الصلاحيات — الهجوم أُبطل من الأساس')
                                .setDescription(`${preventMode ? '🛡️ **وضع المنع**:' : '⚠️'} رول **${newRole.name}**${newRole.id === guild.id ? ' (@everyone)' : ''} حاول الحصول على: **${names}**\n` +
                                `تم إرجاع الصلاحيات ${reverted ? 'فوراً ✅' : 'فشل الاسترجاع ❌'} — فلا يستطيع أحد النيوك أصلاً.`)
                                .setColor(embeds_1.Colors.error)
                                .addFields({ name: 'المنفّذ', value: `${executor.bot ? '🤖' : '👤'} ${executor.tag}`, inline: true }, { name: 'العقوبة', value: punishText, inline: true })
                                .setFooter({ text: 'Liberty City — Permission Guard' })
                                .setTimestamp(),
                        ],
                    }).catch(() => { });
                    logger.warn(`🛡️ Permission guard: reverted [${names}] on ${newRole.name} in ${guild.name} | reverted=${reverted} | punish=${punishText}`);
                    if (!deferToAntiAdmin)
                        return; // لا يوجد منح Administrator — انتهى الحارس هنا
                }
            }
            if (!gainedAdmin)
                return;
            const cfg = antiAdminCfg;
            if (!cfg?.enabled)
                return;
            const isEveryone = newRole.id === guild.id;
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.RoleUpdate, newRole.id);
            if (!executor)
                return;
            if (executor.id === this.client.user?.id)
                return;
            if (await this.isTrustedExecutor(guild, executor.id))
                return; // 👑 مالك/مطوّر
            const executorMember = guild.members.cache.get(executor.id);
            if (!executorMember)
                return;
            // 🛡️ فحص التسلسل الهرمي
            const hierarchy = this.checkHierarchy(guild);
            if (!hierarchy.ok) {
                logger.warn(`Anti-Admin skipped in ${guild.name} — bot not top role`);
                return;
            }
            const botMember = guild.members.me;
            const canManageRoles = botMember?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles) ?? false;
            const canKick = botMember?.permissions.has(discord_js_1.PermissionFlagsBits.KickMembers) ?? false;
            const action = cfg.action || 'alert'; // 'alert' | 'kick'
            let permRevoked = false;
            let punished = false;
            let punishType = 'none';
            // 1️⃣ استرجاع صلاحية Administrator فوراً
            //    (وضع المنع: إرجاع كامل للصلاحيات القديمة — يلغي أيضاً أي صلاحيات خطيرة أخرى اكتسبها الرول)
            if (canManageRoles) {
                try {
                    if (nukeCfg?.enabled) {
                        await newRole.setPermissions(oldRole.permissions, 'Security: permissions reverted (anti-admin + permission guard)');
                    }
                    else {
                        const perms = newRole.permissions;
                        perms.remove(discord_js_1.PermissionFlagsBits.Administrator);
                        await newRole.setPermissions(perms, 'Security: Administrator revoked (anti-admin)');
                    }
                    permRevoked = true;
                }
                catch (e) {
                    logger.warn(`Failed to revoke Administrator in ${guild.name}: ${e.message}`);
                }
            }
            // 2️⃣ العقوبة حسب الإعداد
            if (action === 'kick' && canKick && executorMember) {
                try {
                    await executorMember.kick('Security: granted Administrator (anti-admin)');
                    punished = true;
                    punishType = 'kick';
                }
                catch (e) {
                    logger.warn(`Failed to kick admin granter in ${guild.name}: ${e.message}`);
                }
            }
            // 3️⃣ إرسال التقرير
            const alert = await this.getAlertChannel(guild, settings, cfg.logChannel);
            const executorType = executor.bot ? '🤖 بوت' : '👤 عضو';
            let msg = `⚠️ **منح صلاحية Administrator ${isEveryone ? 'لـ @everyone' : `للرول ${newRole.name}`}**\n`;
            msg += `🎯 المنفّذ: ${executorType} ${executor.tag}\n`;
            msg += `🔄 استرجاع Administrator: ${permRevoked ? '✅ تم' : canManageRoles ? '❌ فشل' : '⚠️ لا توجد صلاحية ManageRoles'}\n`;
            if (action === 'alert') {
                msg += `🔔 الإجراء: تنبيه فقط (حسب إعدادات antiAdmin)`;
            }
            else {
                msg += `🛡️ العقوبة (${action}): ${punished ? `✅ ${punishType}` : '❌ فشل — تحقق من الصلاحيات/الهرمية'}`;
            }
            alert?.send({ content: msg }).catch(() => { });
            logger.warn(`⚠️ Anti-Admin: Administrator granted to ${isEveryone ? '@everyone' : newRole.name} in ${guild.name} | revoked=${permRevoked} | action=${action} | punished=${punished}`);
        }
        catch (error) {
            logger.error(`onRoleUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 4) AUTO-BACKUP: نسخ احتياطي دوري + الاستعادة
    // --------------------------------------------
    // (Re)جدولة المؤقت — استدعها عند ready وعند تبديل التبديل
    async syncAutoBackup(guild, forceNow = false) {
        try {
            const existing = this.backupTimers.get(guild.id);
            if (existing) {
                clearInterval(existing);
                this.backupTimers.delete(guild.id);
            }
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.autoBackup;
            if (!cfg?.enabled)
                return;
            const hours = Math.min(72, Math.max(1, cfg.interval ?? 6));
            const timer = setInterval(() => {
                this.createBackup(guild).catch(err => logger.error(`Scheduled backup failed (${guild.name}): ${err.message}`));
            }, hours * 3600 * 1000);
            this.backupTimers.set(guild.id, timer);
            // نسخة أولى فورية إذا لم توجد نسخ أصلاً
            const doc = await models_1.BackupConfig.findOne({ guildId: guild.id }).lean();
            if (forceNow || !doc?.backups?.length) {
                setTimeout(() => {
                    this.createBackup(guild).catch(err => logger.error(`Initial backup failed (${guild.name}): ${err.message}`));
                }, 5000);
            }
            logger.info(`💾 Auto-backup scheduled: ${guild.name} (كل ${hours} ساعة)`);
        }
        catch (error) {
            logger.error(`syncAutoBackup error (${guild.name}): ${error.message}`);
        }
    }
    // --------------------------------------------
    // 4b) AUTO-SCAN: فحص دوري كل N ساعات — كشف هاكر وإصلاح تلقائي
    // --------------------------------------------
    // (Re)جدولة مؤقت الفحص — استدعها عند ready وعند تبديل المفتاح في الإعدادات
    async syncAutoScan(guild) {
        try {
            const existing = this.scanTimers.get(guild.id);
            if (existing) {
                clearInterval(existing);
                this.scanTimers.delete(guild.id);
            }
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.autoScan;
            if (!cfg?.enabled)
                return;
            const hours = Math.min(72, Math.max(1, cfg.interval ?? 6));
            const timer = setInterval(() => {
                this.runPeriodicScan(guild).catch(err => logger.error(`Periodic scan failed (${guild.name}): ${err.message}`));
            }, hours * 3600 * 1000);
            this.scanTimers.set(guild.id, timer);
            logger.info(`🔍 Auto-scan scheduled: ${guild.name} (كل ${hours} ساعة)`);
        }
        catch (error) {
            logger.error(`syncAutoScan error (${guild.name}): ${error.message}`);
        }
    }
    // 🔍 تنفيذ الفحص الدوري — يمسح رومات/رولات الهاكر ويرجّع الناقص
    async runPeriodicScan(guild) {
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const cfg = settings.protection?.autoScan;
            if (!cfg?.enabled)
                return;
            // 1️⃣ حذف أي روم/رول مشبوه (نمط الهاكر)
            const suspiciousDeleted = await this.cleanupSuspicious(guild);
            // 2️⃣ مقارنة بالآخر نسخة احتياطية — ناقص = مهجم
            const doc = await models_1.BackupConfig.findOne({ guildId: guild.id }).lean();
            const backup = doc?.backups?.length ? doc.backups[doc.backups.length - 1] : null;
            if (!backup?.data)
                return; // مافيش نسخة → مافيش مقارنة
            const curChannels = new Set(Array.from(guild.channels.cache.values()).map((c) => `${c.name}:${c.type}`));
            const curRoles = new Set(Array.from(guild.roles.cache.values()).map((r) => r.name));
            const missingChannels = (backup.data.channels || []).filter((cd) => RESTORABLE_CHANNEL_TYPES.includes(cd.type) &&
                !cd.name?.includes('category-') &&
                !curChannels.has(`${cd.name}:${cd.type}`));
            const missingRoles = (backup.data.roles || []).filter((rd) => !curRoles.has(rd.name));
            const clean = suspiciousDeleted === 0 && missingChannels.length === 0 && missingRoles.length === 0;
            // ✅ السيرفر سليم → صامت تماماً (مافيش رسائل)
            if (clean) {
                logger.info(`🔍 Periodic scan OK: ${guild.name} — لا تغييرات`);
                return;
            }
            // 3️⃣ فيه اختراق → استعادة كاملة من النسخة
            const result = await this.restoreBackup(guild);
            const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
            if (channel) {
                await channel
                    .send({
                    content: `🔍 **فحص دوري (كل ${cfg.interval ?? 6} ساعات) — اكتُشف اختراق!**\n` +
                        `🧹 مسحت **${suspiciousDeleted}** روم/رول هاك\n` +
                        `♻️ رجّعت **${result.channels}** قناة و **${result.roles}** رول` +
                        (result.skipped ? ` (تخطّيت ${result.skipped} موجود)` : ''),
                })
                    .catch(() => { });
            }
            logger.warn(`🔍 Periodic scan ${guild.name}: suspicious=${suspiciousDeleted} restored=${result.channels}ch/${result.roles}ro`);
        }
        catch (error) {
            logger.error(`runPeriodicScan error (${guild.name}): ${error.message}`);
        }
    }
    // إنشاء نسخة احتياطية (بنية القنوات + الرولات)
    async createBackup(guild) {
        // نمط المشبوه — لا يُحفظ في النسخة الاحتياطية
        const SUSPICIOUS = /nuked|hacked|kly|rcl|cracked|death.?note|pwned|owned|here|on.?top|spam|raid|destroy|test.?123|vxl.?hak/i;
        const channels = guild.channels.cache
            .filter(c => !c.isThread() && !SUSPICIOUS.test(c.name))
            .map(c => {
            const guildChannel = c; // GuildChannel types
            const base = {
                id: c.id,
                name: c.name,
                type: c.type,
                position: 'position' in c ? guildChannel.position : 0,
                topic: guildChannel.topic ?? null,
                parentId: c.parentId ?? null,
                nsfw: guildChannel.nsfw ?? false,
                rateLimitPerUser: guildChannel.rateLimitPerUser ?? 0,
            };
            // حفظ الأوفررايتس (الصلاحيات)
            let permissionOverwrites = [];
            if (guildChannel.permissionOverwrites?.cache) {
                permissionOverwrites = guildChannel.permissionOverwrites.cache.map((ow) => ({
                    id: ow.id,
                    type: ow.type, // 'role' | 'member'
                    allow: ow.allow?.toString() ?? '0',
                    deny: ow.deny?.toString() ?? '0',
                }));
            }
            return { ...base, permissionOverwrites };
        })
            .sort((a, b) => a.position - b.position);
        const roles = guild.roles.cache
            .filter(r => r.id !== guild.id && !r.managed && !SUSPICIOUS.test(r.name))
            .sort((a, b) => b.position - a.position)
            .map(r => ({
            id: r.id,
            name: r.name,
            color: r.hexColor,
            permissions: r.permissions.bitfield.toString(),
            hoist: r.hoist,
            mentionable: r.mentionable,
            position: r.position,
        }));
        const data = {
            guildName: guild.name,
            memberCount: guild.memberCount,
            channels,
            roles,
        };
        const size = JSON.stringify(data).length;
        let doc = await models_1.BackupConfig.findOne({ guildId: guild.id });
        if (!doc) {
            doc = new models_1.BackupConfig({ guildId: guild.id, enabled: true, interval: 'daily' });
        }
        doc.backups.push({ date: new Date(), data, size });
        const keep = 5;
        while (doc.backups.length > keep)
            doc.backups.shift();
        doc.lastBackup = new Date();
        await doc.save();
        logger.info(`💾 Backup created for ${guild.name}: ${channels.length} channels, ${roles.length} roles (${(size / 1024).toFixed(1)} KB)`);
        return { channels: channels.length, roles: roles.length, size };
    }
    // استعادة البنية — يُعاد إنشاء القنوات/الرولات المفقودة فقط (غير هدام)
    // 🔒 مقفل تزامن: لو استعادة جارية على نفس السيرفر ننتظر نتيجتها بدل
    //    تشغيل استعادة ثانية — وإلا تُنشأ القنوات مكرّرة عند الهجوم المتسارع
    async restoreBackup(guild, backupIndex) {
        const inflight = this.restoreLocks.get(guild.id);
        if (inflight) {
            logger.info(`♻️ استعادة جارية بالفعل في ${guild.name} — ننتظر نتيجتها`);
            return inflight;
        }
        const run = this.performRestore(guild, backupIndex).finally(() => this.restoreLocks.delete(guild.id));
        this.restoreLocks.set(guild.id, run);
        return run;
    }
    async performRestore(guild, backupIndex) {
        const doc = await models_1.BackupConfig.findOne({ guildId: guild.id });
        if (!doc?.backups?.length)
            throw new Error('لا توجد نسخ احتياطية — أنشئ واحدة أولاً بـ `/backup create`');
        const backup = backupIndex === undefined ? doc.backups[doc.backups.length - 1] : doc.backups[backupIndex];
        if (!backup)
            throw new Error('رقم النسخة غير صحيح — استخدم `/backup list`');
        const data = backup.data;
        const result = { channels: 0, roles: 0, skipped: 0 };
        const idMap = {};
        // نمط القنوات/الرولات المشبوهة — لا تُستعاد أبداً
        const SUSPICIOUS_PATTERN = /nuked|hacked|kly|rcl|cracked|death.?note|pwned|owned|here|on.?top|spam|raid|destroy|test.?123|vxl.?hak/i;
        // 1) الرولات — إنشاء بالترتيب الدقيق من النسخة الاحتياطية
        const sortedRoles = [...(data.roles || [])].sort((a, b) => (b.position || 0) - (a.position || 0));
        for (const rd of sortedRoles) {
            if (SUSPICIOUS_PATTERN.test(rd.name)) {
                result.skipped++;
                continue;
            }
            // التحقق من وجود الرول (بالمعرف أو بالاسم + الموقع)
            let exists = guild.roles.cache.get(rd.id);
            if (!exists) {
                // البحث بالرول اللي بنفس الاسم ومفيش conflict
                exists = guild.roles.cache.find(r => r.name === rd.name && r.id !== guild.id);
            }
            if (exists) {
                idMap[`role:${rd.id}`] = exists.id;
                result.skipped++;
                continue;
            }
            let attempts = 0;
            let created2 = false;
            while (!created2 && attempts < 10) {
                attempts++;
                try {
                    const created = await guild.roles.create({
                        name: rd.name,
                        color: rd.color,
                        permissions: BigInt(rd.permissions),
                        hoist: !!rd.hoist,
                        mentionable: !!rd.mentionable,
                        reason: 'Liberty City — استعادة نسخة احتياطية',
                    });
                    idMap[`role:${rd.id}`] = created.id;
                    result.roles++;
                    created2 = true;
                }
                catch (error) {
                    const isRateLimit = error?.status === 429 ||
                        error?.httpStatus === 429 ||
                        /rate limit|too many/i.test(error?.message || '');
                    if (isRateLimit) {
                        const retryAfter = error?.retry_after ?? error?.data?.retry_after ?? 60;
                        const waitMs = Math.min((Number(retryAfter) || 60) * 1000 + 3000, 700000);
                        logger.warn(`restore role "${rd.name}" — rate limited, waiting ${Math.round(waitMs / 1000)}s`);
                        await sleep(waitMs);
                    }
                    else {
                        logger.warn(`restore role "${rd.name}" failed: ${error.message}`);
                        result.skipped++;
                        created2 = true;
                    }
                }
            }
            if (!created2)
                result.skipped++;
            await sleep(700);
        }
        // 2) إعادة ترتيب الرولات بدقة حسب النسخة الاحتياطية
        if (result.roles > 0) {
            try {
                await sleep(2000);
                const curRoles = await guild.roles.fetch();
                const nameToRole = new Map();
                for (const [, role] of curRoles) {
                    if (role.managed || role.id === guild.id)
                        continue;
                    if (!nameToRole.has(role.name)) {
                        nameToRole.set(role.name, role);
                    }
                }
                const positions = [];
                // استخدام الترتيب من النسخة الاحتياطية مباشرة
                for (const rd of sortedRoles) {
                    if (SUSPICIOUS_PATTERN.test(rd.name))
                        continue;
                    const role = nameToRole.get(rd.name);
                    if (role && role.id !== guild.id) {
                        // الموقع الدقيق من النسخة (أعلى position = رقم أعلى)
                        positions.push({ role: role.id, position: rd.position || 0 });
                    }
                }
                if (positions.length > 1) {
                    // ترتيب تنازلي للأعلى أولاً
                    positions.sort((a, b) => b.position - a.position);
                    await guild.roles.setPositions(positions);
                    logger.info(`📐 Reordered ${positions.length} roles to match backup positions exactly`);
                }
            }
            catch (error) {
                logger.warn(`Role reorder failed: ${error.message}`);
            }
        }
        // 3) القنوات — الفئات أولاً، ثم الترتيب الدقيق
        const sortedChannels = [...(data.channels || [])].sort((a, b) => {
            const aCat = a.type === discord_js_1.ChannelType.GuildCategory ? 0 : 1;
            const bCat = b.type === discord_js_1.ChannelType.GuildCategory ? 0 : 1;
            if (aCat !== bCat)
                return aCat - bCat;
            return (a.position || 0) - (b.position || 0);
        });
        for (const cd of sortedChannels) {
            if (!RESTORABLE_CHANNEL_TYPES.includes(cd.type))
                continue;
            if (SUSPICIOUS_PATTERN.test(cd.name)) {
                result.skipped++;
                continue;
            }
            const exists = guild.channels.cache.get(cd.id) ||
                guild.channels.cache.find(c => c.name === cd.name && c.type === cd.type);
            if (exists) {
                idMap[`ch:${cd.id}`] = exists.id;
                result.skipped++;
                continue;
            }
            try {
                const parentId = cd.parentId
                    ? idMap[`ch:${cd.parentId}`] || guild.channels.cache.get(cd.parentId)?.id
                    : undefined;
                const created = await guild.channels.create({
                    name: cd.name,
                    type: cd.type,
                    ...(cd.topic ? { topic: cd.topic } : {}),
                    ...(cd.nsfw ? { nsfw: true } : {}),
                    ...(parentId ? { parent: parentId } : {}),
                    reason: 'Liberty City — استعادة نسخة احتياطية',
                });
                idMap[`ch:${cd.id}`] = created.id;
                result.channels++;
                // ضبط الموقع بدقة من النسخة الاحتياطية
                if (typeof cd.position === 'number' && cd.position >= 0) {
                    await created.setPosition(cd.position).catch(() => { });
                }
            }
            catch (error) {
                logger.warn(`restore channel "${cd.name}" failed: ${error.message}`);
                result.skipped++;
            }
            await sleep(700);
        }
        // 4) ضبط صلاحيات القنوات (overwrites) من النسخة الاحتياطية
        if (result.channels > 0) {
            try {
                await sleep(1000);
                for (const cd of sortedChannels) {
                    if (!RESTORABLE_CHANNEL_TYPES.includes(cd.type))
                        continue;
                    if (SUSPICIOUS_PATTERN.test(cd.name))
                        continue;
                    const channelId = idMap[`ch:${cd.id}`] || guild.channels.cache.get(cd.id)?.id;
                    if (!channelId)
                        continue;
                    const channel = guild.channels.cache.get(channelId);
                    if (!channel || !cd.permissionOverwrites)
                        continue;
                    for (const ow of cd.permissionOverwrites) {
                        if (!ow.id || !ow.allow || !ow.deny)
                            continue;
                        // تحويل الـ ID القديم للـ ID الجديد للرول
                        let targetId = ow.id;
                        if (ow.type === 'role') {
                            targetId = idMap[`role:${ow.id}`] || ow.id;
                        }
                        try {
                            const gChannel = channel;
                            await gChannel.permissionOverwrites.edit(targetId, {
                                Allow: BigInt(ow.allow),
                                Deny: BigInt(ow.deny),
                            }, 'Liberty City — استعادة أوفررايتس').catch(() => { });
                        }
                        catch { }
                    }
                }
            }
            catch (error) {
                logger.warn(`Permission overwrites restore failed: ${error.message}`);
            }
        }
        logger.info(`🔓 Restore for ${guild.name}: +${result.channels} channels, +${result.roles} roles, skipped ${result.skipped}`);
        return result;
    }
    // عرض النسخ المحفوظة
    async listBackups(guildId) {
        const doc = await models_1.BackupConfig.findOne({ guildId });
        if (!doc?.backups?.length)
            return [];
        return doc.backups.map((b, i) => ({
            index: i + 1,
            date: b.date,
            size: b.size || 0,
            channels: b.data?.channels?.length ?? 0,
            roles: b.data?.roles?.length ?? 0,
        }));
    }
}
exports.SecurityHandler = SecurityHandler;
//# sourceMappingURL=SecurityHandler.js.map