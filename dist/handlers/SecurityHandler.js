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
    // تتبّع تغيير الأسماء السريع: key → توقيتات
    renameTracker = new Map();
    // مؤقتات النسخ الاحتياطي التلقائي
    backupTimers = new Map();
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
    constructor(client) {
        this.client = client;
    }
    cleanup() {
        for (const timer of this.backupTimers.values())
            clearInterval(timer);
        this.backupTimers.clear();
        for (const timer of this.restoreTimers.values())
            clearTimeout(timer);
        this.restoreTimers.clear();
        this.restoreLocks.clear();
        for (const timer of this.kickedTimers.values())
            clearTimeout(timer);
        this.kickedTimers.clear();
        this.kickedQueue.clear();
    }
    // --------------------------------------------
    // Helpers
    // --------------------------------------------
    // قناة تنبيهات الأمن: مخصصة → سجلات → نظام → أول قناة قابلة للإرسال
    async getAlertChannel(guild, settings, specific) {
        const candidates = [
            specific,
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
    // تحديد المنفّذ من سجلات التدقيق
    async findExecutor(guild, type, targetId) {
        try {
            const logs = await guild.fetchAuditLogs({ type, limit: 5 });
            const recent = logs.entries.filter(e => Date.now() - e.createdTimestamp < 20000);
            const entry = (targetId ? recent.find(e => e.targetId === targetId) : undefined) ?? recent.first();
            const executor = entry?.executor;
            return executor ? executor : null;
        }
        catch (error) {
            logger.warn(`fetchAuditLogs failed in ${guild.name}: ${error.message}`);
            return null;
        }
    }
    // معاقبة المخالف (تجاهل: المالك، البوت نفسه، غير الموجود)
    // نوع العقوبة: alert | kick | ban | strip (سلب كل الرولات)
    async punish(guild, executor, action, reason) {
        if (executor.id === guild.ownerId)
            return '⏭️ المالك مستثناً';
        if (executor.id === this.client.user?.id)
            return '⏭️ البوت مستثنى';
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
                // نبلّغ عن مشكلة التسلّم (تنبيه واحد فقط عند التغيّر)
                void this.ensureHierarchyAlert(guild);
                return (`⛔ **رتبته فوق البوت** (‎${targetTop.name}‎ ≥ ‎${botTop.name}‎) — ` +
                    `العقوبة مستحيلة. اسحب رول البوت لأعلى القائمة`);
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
                let removed = 0;
                for (const role of target) {
                    // كل رولة على حدة — لو فشلت واحدة بسبب التسلّم نكمل الباقي
                    const ok = await role
                        .delete(`Liberty City Anti-Nuke: ${reason}`)
                        .then(() => true)
                        .catch(() => false);
                    if (ok)
                        removed++;
                }
                if (removed === 0) {
                    void this.ensureHierarchyAlert(guild);
                    return (`⛔ تعذّر سلب أي رولة من ${target.length} — ` +
                        `تحقّق من تسلّم البوت (ارفع رول البوت للأعلى)`);
                }
                return `🗡️ تم سلب **${removed}/${target.length}** رولة — باقٍ في السيرفر بلا صلاحيات`;
            }
        }
        catch (error) {
            logger.warn(`punish failed (${action}) in ${guild.name}: ${error.message}`);
            void this.ensureHierarchyAlert(guild);
            return `⚠️ فشل التنفيذ (${error.message}) — راجع تسلّم البوت`;
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
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
            if (!channel)
                return status;
            // ✅ شُفّت المشكلة — نؤكد للّي صلّحها
            if (status.ok) {
                await channel
                    .send({
                    embeds: [
                        new discord_js_1.EmbedBuilder()
                            .setTitle('✅ إصلاح التسلّم — البوت الآن أعلى رتبة')
                            .setDescription(`**${status.botRoleName}** أصبحت أعلى رتبة في السيرفر — الحماية تعمل بالكامل الآن: مضاد النيوك يطرد ويحظر، والاستعادة التلقائية تعمل.`)
                            .setColor(embeds_1.Colors.success)
                            .setFooter({ text: 'Liberty City — Hierarchy Guard' })
                            .setTimestamp(),
                    ],
                })
                    .catch(() => { });
                logger.info(`✅ Hierarchy fixed in ${guild.name}`);
                return status;
            }
            // ❌ مشكلة جديدة → تنبيه عالي الخطورة مع الخطوات
            const lines = status.offenders.length
                ? status.offenders.join('\n')
                : '— (رول غير مُدار أعلى البوت)';
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🚨 فحص التسلّم — البوت ليس أعلى رتبة!')
                .setDescription('**هذه أخطر ثغرة في حماية السيرفر.**\n' +
                'لو أي أحد فوق البوت، **كل العقوبات تفشل بصمت**: مضاد النيوك ما يقدر يطرد ولا يحظر المخالف، والاستعادة التلقائية قد تتعطّل — والهجوم ينجح بلا مقاومة.')
                .setColor(embeds_1.Colors.error)
                .addFields({
                name: '📌 أعلى رتبة للبوت',
                value: `${status.botRoleName} — الموقع \`#${status.botPosition}\``,
                inline: true,
            }, {
                name: `⛔ الرولات فوق البوت (${status.offenderCount})`,
                value: lines,
                inline: false,
            }, {
                name: '🎯 الخطر الحالي',
                value: status.dangerous
                    ? '⚠️ **رول فوق البوت يحمل صلاحيات خطيرة** (أدمنستريتر/إدارة/حظر) — أي صاحبه لا يُمسّ.'
                    : 'الرولات فوق البوت أدنى خطر، لكنها تمنع معاقبة أصحابها.',
                inline: false,
            }, {
                name: '✅ الخطوتين للاصلاح',
                value: '**1.** افتح Server Settings ← Roles\n' +
                    `**2.** اسحب رول البوت (‎${status.botRoleName}‎) **لأعلى القائمة** — يبقى الأول مباشرة تحت @everyone\n\n` +
                    '_ملاحظة: من يملك المالك (⭐) يبقى فوق الجميع تلقائياً._',
                inline: false,
            })
                .setFooter({ text: 'Liberty City — Hierarchy Guard' })
                .setTimestamp();
            await channel.send({ embeds: [embed], content: `<@${guild.ownerId}>` }).catch(() => { });
            logger.warn(`🚨 Hierarchy: bot NOT top in ${guild.name} | bot=#${status.botPosition} | offenders=${status.offenderCount}`);
        }
        catch (error) {
            logger.error(`ensureHierarchyAlert error: ${error.message}`);
        }
        return status;
    }
    // وايت ليست: الأونر + من معه Administrator + مطور البوت = موثوق
    isWhitelisted(guild, executorId) {
        if (executorId === guild.ownerId)
            return true;
        // مطور البوت (DEVELOPER_USER_ID من .env) = وايت ليست في كل السيرفرات
        const devId = process.env.DEVELOPER_USER_ID;
        if (devId && executorId === devId)
            return true;
        const member = guild.members.cache.get(executorId);
        return member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) ?? false;
    }
    // --------------------------------------------
    // 0) ANTI-CREATE: أي بوت ينشئ قناة/رول → يُحذف فوراً (ماعدا الأونر والإدارة)
    // --------------------------------------------
    async onChannelCreate(channel) {
        try {
            if (!channel?.guild)
                return;
            const logs = await channel.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.ChannelCreate, limit: 5 });
            const entry = logs.entries.first();
            if (!entry?.executor)
                return;
            if (Date.now() - entry.createdTimestamp > 3000)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (this.isWhitelisted(channel.guild, entry.executor.id))
                return; // الأونر والإدارة موثوقون
            if (!entry.executor.bot)
                return; // البشر مسموح (ماعدا لو سبام)
            const member = channel.guild.members.cache.get(entry.executor.id);
            try {
                await channel.delete('Security: bot cannot create channels');
            }
            catch { }
            if (member) {
                try {
                    await member.roles.set([], 'Security: bot created channel');
                }
                catch { }
            }
            const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
            const alert = await this.getAlertChannel(channel.guild, settings);
            alert?.send({ content: `🚫 **بوت حاول إنشاء قناة:** ${entry.executor.tag} — تم الحذف وسحب الصلاحيات` }).catch(() => { });
        }
        catch (error) {
            logger.error(`onChannelCreate error: ${error.message}`);
        }
    }
    async onRoleCreate(role) {
        try {
            if (!role?.guild || role.managed)
                return;
            const logs = await role.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.RoleCreate, limit: 5 });
            const entry = logs.entries.first();
            if (!entry?.executor)
                return;
            if (Date.now() - entry.createdTimestamp > 3000)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (this.isWhitelisted(role.guild, entry.executor.id))
                return;
            if (!entry.executor.bot)
                return;
            const member = role.guild.members.cache.get(entry.executor.id);
            try {
                await role.delete('Security: bot cannot create roles');
            }
            catch { }
            if (member) {
                try {
                    await member.roles.set([], 'Security: bot created role');
                }
                catch { }
            }
            const settings = await (0, models_1.getGuildSettings)(role.guild.id);
            const alert = await this.getAlertChannel(role.guild, settings);
            alert?.send({ content: `🚫 **بوت حاول إنشاء رول:** ${entry.executor.tag} — تم الحذف وسحب الصلاحيات` }).catch(() => { });
        }
        catch (error) {
            logger.error(`onRoleCreate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 0b) ANTI-RENAME: تغيير اسم قناة بسرعة → رد على المنفذ (ماعدا الأونر والإدارة)
    // --------------------------------------------
    async onChannelUpdate(oldChannel, newChannel) {
        try {
            if (!newChannel?.guild || oldChannel.name === newChannel.name)
                return;
            const logs = await newChannel.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.ChannelUpdate, limit: 5 });
            const entry = logs.entries.first();
            if (!entry?.executor)
                return;
            if (Date.now() - entry.createdTimestamp > 3000)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (this.isWhitelisted(newChannel.guild, entry.executor.id))
                return;
            const member = newChannel.guild.members.cache.get(entry.executor.id);
            // Track rapid renames
            const key = `${newChannel.guild.id}:${entry.executor.id}:rename`;
            if (!this.renameTracker.has(key))
                this.renameTracker.set(key, []);
            const arr = this.renameTracker.get(key);
            const now = Date.now();
            arr.push(now);
            const recent = arr.filter((t) => now - t < 10000);
            this.renameTracker.set(key, recent);
            // Restore original name
            try {
                await newChannel.setName(oldChannel.name, 'Security: rapid rename detected');
            }
            catch { }
            // If 3+ renames in 10s → strip (ماعدا الأونر)
            if (recent.length >= 3 && !this.isWhitelisted(newChannel.guild, entry.executor.id)) {
                if (member) {
                    try {
                        await member.roles.set([], 'Security: mass rename');
                    }
                    catch { }
                    try {
                        await member.kick('Security: mass channel rename');
                    }
                    catch { }
                }
                this.renameTracker.set(key, []);
            }
            const settings = await (0, models_1.getGuildSettings)(newChannel.guild.id);
            const alert = await this.getAlertChannel(newChannel.guild, settings);
            alert?.send({ content: `✏️ **${entry.executor.bot ? 'بوت' : 'عضو'} غيّر اسم قناة بسرعة:** ${entry.executor.tag} — تمت إعادة الاسم${recent.length >= 3 ? ' + طرد المنفذ' : ''}` }).catch(() => { });
        }
        catch (error) {
            logger.error(`onChannelUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // 0c) AUTO-CLEAN: حذف تلقائي لأي روم/رول مشبوه بعد الهكر
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
    // Pro Max: ANTI-WEBHOOK SPAM — بوت ينشئ ويب هوك → يُحذف (ماعدا الأونر)
    // --------------------------------------------
    async onWebhookUpdate(webhook) {
        try {
            if (!webhook?.guild)
                return;
            const logs = await webhook.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.WebhookCreate, limit: 5 });
            const entry = logs.entries.first();
            if (!entry?.executor)
                return;
            if (Date.now() - entry.createdTimestamp > 3000)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (this.isWhitelisted(webhook.guild, entry.executor.id))
                return;
            const member = webhook.guild.members.cache.get(entry.executor.id);
            try {
                await webhook.delete('Security: bot/webhook spam');
            }
            catch { }
            if (member) {
                try {
                    await member.roles.set([], 'Security: created webhook');
                }
                catch { }
                try {
                    await member.kick('Security: webhook spam');
                }
                catch { }
            }
            const settings = await (0, models_1.getGuildSettings)(webhook.guild.id);
            const alert = await this.getAlertChannel(webhook.guild, settings);
            alert?.send({ content: `🔗 **بوت/عضو أنشأ ويب هوك:** ${entry.executor.tag} — تم الحذف والعقاب` }).catch(() => { });
        }
        catch (error) {
            logger.error(`onWebhookUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Pro Max: ANTI-ROLE ASSIGNMENT SPAM — إعطاء رول لعدد كبير (ماعدا الأونر)
    // --------------------------------------------
    async onGuildMemberUpdate(oldMember, newMember) {
        try {
            if (!newMember?.guild)
                return;
            const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
            if (addedRoles.size === 0)
                return;
            const logs = await newMember.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.MemberRoleUpdate, limit: 5 });
            const entry = logs.entries.first();
            if (!entry?.executor)
                return;
            if (Date.now() - entry.createdTimestamp > 3000)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (this.isWhitelisted(newMember.guild, entry.executor.id))
                return;
            const executorMember = newMember.guild.members.cache.get(entry.executor.id);
            // Track
            const key = `${newMember.guild.id}:${entry.executor.id}:roleassign`;
            if (!this.renameTracker.has(key))
                this.renameTracker.set(key, []);
            const arr = this.renameTracker.get(key);
            const now = Date.now();
            arr.push(now);
            const recent = arr.filter((t) => now - t < 10000);
            this.renameTracker.set(key, recent);
            // If 5+ role assignments in 10s → strip
            if (recent.length >= 5 && !this.isWhitelisted(newMember.guild, entry.executor.id)) {
                try {
                    await executorMember?.roles.set([], 'Security: mass role assignment');
                }
                catch { }
                try {
                    await executorMember?.kick('Security: mass role assignment');
                }
                catch { }
            }
            // Revert roles on target
            try {
                await newMember.roles.remove(addedRoles, 'Security: unauthorized role assignment');
            }
            catch { }
            const settings = await (0, models_1.getGuildSettings)(newMember.guild.id);
            const alert = await this.getAlertChannel(newMember.guild, settings);
            alert?.send({ content: `🎭 **${entry.executor.bot ? 'بوت' : 'عضو'} أعطى رولات جماعي:** ${entry.executor.tag} — أُعيدت الرولات${recent.length >= 5 ? ' + طرد المنفذ' : ''}` }).catch(() => { });
        }
        catch (error) {
            logger.error(`onGuildMemberUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Pro Max: ANTI-PERMISSION OVERWRITE CHANGES — تعديل صلاحيات القنوات (ماعدا الأونر)
    // --------------------------------------------
    async onChannelPermissionUpdate(oldChannel, newChannel) {
        try {
            if (!newChannel?.guild)
                return;
            // Check if permission overwrites changed significantly
            const oldOverwrites = oldChannel.permissionOverwrites?.cache?.size ?? 0;
            const newOverwrites = newChannel.permissionOverwrites?.cache?.size ?? 0;
            if (Math.abs(oldOverwrites - newOverwrites) < 2)
                return;
            const logs = await newChannel.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.ChannelUpdate, limit: 5 });
            const entry = logs.entries.first();
            if (!entry?.executor)
                return;
            if (Date.now() - entry.createdTimestamp > 3000)
                return;
            if (this.isWhitelisted(newChannel.guild, entry.executor.id))
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            const member = newChannel.guild.members.cache.get(entry.executor.id);
            if (member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
                return;
            // Restore overwrites
            try {
                await newChannel.permissionOverwrites.set(oldChannel.permissionOverwrites.cache.map((o) => [o.id, o]), 'Security: permission overwrite spam');
            }
            catch { }
            const settings = await (0, models_1.getGuildSettings)(newChannel.guild.id);
            const alert = await this.getAlertChannel(newChannel.guild, settings);
            alert?.send({ content: `🔐 **${entry.executor.bot ? 'بوت' : 'عضو'} غيّر صلاحيات قناة:** ${entry.executor.tag} — أُعيدت الصلاحيات` }).catch(() => { });
        }
        catch (error) {
            logger.error(`onChannelPermissionUpdate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Pro Max: STICKY BOT ROLE POSITION — كل 10 ثواني يتأكد إن رول البوت في القمة
    // --------------------------------------------
    startStickyRoleWatchdog(guild) {
        if (this.topWatchdogs?.has?.(guild.id))
            return;
        const check = async () => {
            try {
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
                        await botRole.setPosition(highestUserRole.position + 1, { reason: 'Security: sticky top position' });
                        // 🔕 صامت — التنبيه مرة واحدة كل ساعة بحد أقصى (مافيش سبام)
                        if (!this.stickyAlertAt)
                            this.stickyAlertAt = new Map();
                        const last = this.stickyAlertAt.get(guild.id) ?? 0;
                        if (Date.now() - last > 60 * 60 * 1000) {
                            this.stickyAlertAt.set(guild.id, Date.now());
                            const settings = await (0, models_1.getGuildSettings)(guild.id);
                            const alert = await this.getAlertChannel(guild, settings);
                            alert?.send({ content: `📌 **حماية الهرم:** رول البوت رُفع فوق ${highestUserRole.name}` }).catch(() => { });
                        }
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
            const logs = await thread.guild.fetchAuditLogs({ type: discord_js_1.AuditLogEvent.ThreadCreate, limit: 5 });
            const entry = logs.entries.first();
            if (!entry?.executor)
                return;
            if (Date.now() - entry.createdTimestamp > 3000)
                return;
            if (entry.executor.id === this.client.user?.id)
                return;
            if (this.isWhitelisted(thread.guild, entry.executor.id))
                return;
            if (!entry.executor.bot)
                return;
            const member = thread.guild.members.cache.get(entry.executor.id);
            try {
                await thread.delete('Security: bot cannot create threads');
            }
            catch { }
            if (member) {
                try {
                    await member.roles.set([], 'Security: bot created thread');
                }
                catch { }
            }
            const settings = await (0, models_1.getGuildSettings)(thread.guild.id);
            const alert = await this.getAlertChannel(thread.guild, settings);
            alert?.send({ content: `🧵 **بوت حاول إنشاء ثريد:** ${entry.executor.tag} — تم الحذف وسحب الصلاحيات` }).catch(() => { });
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
            const threshold = cfg.threshold ?? 3;
            if (count < threshold)
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
            const threshold = cfg.threshold ?? 3;
            if (count < threshold)
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
            const threshold = cfg.threshold ?? 3;
            if (count < threshold)
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
            // نحتفظ بالمطرود ليرسل له رابط الدعوة (استعادة تلقائية)
            const queue = this.kickedQueue.get(member.guild.id) ?? [];
            if (!queue.some(e => e.userId === member.id)) {
                queue.push({ userId: member.id, tag: member.user.tag, at: Date.now() });
                this.kickedQueue.set(member.guild.id, queue);
                this.scheduleKickedRecovery(member.guild, settings);
            }
            // تتبّع العتبة (نفس منطق القنوات/الرولات/الحظر)
            const count = this.track(member.guild.id, 'kick', cfg.timeWindow ?? 10000);
            const threshold = cfg.threshold ?? 3;
            if (count < threshold)
                return;
            this.deletionTracker.get(member.guild.id).kick = [];
            await this.respondMassDeletion(member.guild, settings, cfg, 'kick', discord_js_1.AuditLogEvent.MemberKick, member.id);
        }
        catch (error) {
            logger.error(`onMemberKick error: ${error.message}`);
        }
    }
    // يبحث في سجلات التدقيق عن أمر طرد يستهدف هذا العضو → يعيد المنفّذ
    // (سجلات التدقيق تتأخر ثانية أو ثانيتين، فنحاول ٣ مرات)
    async findKickExecutor(guild, targetId) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.MemberKick, targetId);
            if (executor)
                return executor;
            if (attempt < 2)
                await sleep(600);
        }
        return null;
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
        const executor = await this.findExecutor(guild, auditType, targetId);
        const windowSec = Math.round((cfg.timeWindow ?? 10000) / 1000);
        // وايت ليست: الأونر والإدارة = لا يُعاقبون
        const isWhitelisted = executor && this.isWhitelisted(guild, executor.id);
        let actionText;
        if (executor) {
            if (isWhitelisted) {
                actionText = '✅ **الأونر/إدارة — تم تجاهل العقوبة** (وايت ليست)';
            }
            else {
                actionText = await this.punish(guild, executor, cfg.action ?? 'kick', `Liberty City Anti-Nuke: حذف مكثف (${labels[type].label})`);
            }
        }
        else {
            actionText = '⚠️ تعذّر تحديد المنفّذ من سجلات التدقيق';
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🚨 تحذير أمني — هجوم حذف مكثف!`)
            .setDescription(`${labels[type].emoji} تم حذف **${labels[type].label}** بشكل مكثف خلال ${windowSec} ثانية — هذا نمط هجوم "نيوك" على السيرفر!`)
            .setColor(embeds_1.Colors.error)
            .addFields({ name: 'المخالف', value: executor ? `${executor} (\`${executor.tag}\`)${isWhitelisted ? ' 👑' : ''}` : 'غير معروف', inline: true }, { name: 'الإجراء المتخذ', value: actionText, inline: true }, {
            name: '🛡️ مستوى تسلّم البوت',
            value: await this.hierarchyField(guild),
            inline: false,
        }, {
            name: '♻️ التعافي',
            value: cfg.autoRestore === false
                ? 'الاستعادة التلقائية **مطفأة** — استخدم `/backup restore` يدوياً لاستعادة البنية'
                : 'جاري الاستعادة التلقائية من آخر نسخة احتياطية…',
            inline: false,
        })
            .setFooter({ text: 'Liberty City Anti-Nuke' })
            .setTimestamp();
        const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
        if (channel) {
            await channel.send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined }).catch(() => { });
        }
        logger.warn(`🚨 Anti-Nuke: ${type} x${cfg.threshold} in ${guild.name} | executor=${executor?.tag ?? 'unknown'} | ${actionText}`);
        // ♻️ استعادة تلقائية للبنية — الحظر والطرد لا يُستعادان من النسخة
        //    (المطرودين نستعيدهم عبر رابط الدعوة — انظر scheduleKickedRecovery)
        // 🔑 الاستعادة فقط عند هجوم حقيقي — لو الأونر/إدارة حذفوا بأرادتهم لا نستعيد
        if ((type === 'channel' || type === 'role') && cfg.autoRestore !== false) {
            if (isWhitelisted) {
                logger.info(`♻️ تخطّي الاستعادة التلقائية في ${guild.name} — المنفّذ وايت ليست (حذف يدوي مقصود)`);
            }
            else {
                await this.runAutoRestore(guild, settings, type);
                // 🧹 تنظيف تلقائي: حذف أي روم/رول مشبوه بعد الهكر
                setTimeout(() => this.cleanupSuspicious(guild).catch(() => { }), 3000);
            }
        }
    }
    // سطر يوضّح إذا كان البوت قادرًا فعلاً على العقوبة
    async hierarchyField(guild) {
        try {
            const s = this.checkHierarchy(guild);
            return s.ok
                ? `✅ البوت أعلى رتبة (${s.botRoleName}) — يقدر يعاقب أي أحد`
                : `⛔ **البوت ليس أعلى رتبة** — ${s.offenderCount} رول فوقه، العقوبات تفشل. اسحب رول البوت للأعلى!`;
        }
        catch {
            return '—';
        }
    }
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
            const settings = await (0, models_1.getGuildSettings)(member.guild.id);
            const cfg = settings.protection?.antiBot;
            if (!cfg?.enabled)
                return false;
            if (cfg.whitelist?.includes(member.user.id))
                return false;
            await member.kick('Liberty City Anti-Bot — بوت غير مصرح به').catch(() => { });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 تم طرد بوت غير مصرح به')
                .setDescription('انضم بوت جديد دون إذن — تم طرده تلقائياً بواسطة نظام Anti-Bot')
                .setColor(embeds_1.Colors.warning)
                .addFields({ name: 'البوت', value: `${member.user} (\`${member.user.tag}\`)`, inline: true }, { name: 'المعرف', value: `\`${member.user.id}\``, inline: true }, {
                name: 'إضافة استثناء',
                value: 'استخدم `/protection antibot add:البوت` للاستثناء الدائم',
                inline: false,
            })
                .setFooter({ text: 'Liberty City Anti-Bot' })
                .setTimestamp();
            const channel = await this.getAlertChannel(member.guild, settings);
            if (channel)
                await channel.send({ embeds: [embed] }).catch(() => { });
            logger.warn(`🤖 Anti-Bot: kicked ${member.user.tag} from ${member.guild.name}`);
            return true;
        }
        catch (error) {
            logger.error(`onMemberJoin error: ${error.message}`);
            return false;
        }
    }
    // --------------------------------------------
    // 3) ANTI-ADMIN: منح صلاحية Administrator
    // --------------------------------------------
    // 🚨 تنبيه حرج: خُفّضت رتبة البوت ففقد أعلى رتبة
    async announceBotDemotion(guild, oldRole, newRole) {
        // نُلغي كتم التنبيه ليعاد إطلاقه مع هذه الحالة
        this.hierarchyState.set(guild.id, false);
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
            const executor = await this.findExecutor(guild, discord_js_1.AuditLogEvent.RoleUpdate, newRole.id);
            const s = this.checkHierarchy(guild);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🚨🚨 خُفّضت رتبة البوت — الحماية معطّلة الآن!')
                .setDescription('**هذا أكثر هجوم صامت ضد السيرفر.**\n' +
                `رتبة **${oldRole.name}** نزلت من \`#${oldRole.position}\` إلى \`#${newRole.position}\`، ` +
                'وبذلك **فقد البوت أعلى رتبة**: مضاد النيوك لن يطرد ولا يحظر، والاستعادة التلقائية قد تفشل — ' +
                'والهجوم التالي على السيرفر **سينجح بلا مقاومة**.')
                .setColor(embeds_1.Colors.error)
                .addFields({
                name: '🎯 المنفّذ',
                value: executor ? `${executor} (\`${executor.tag}\`)` : '⚠️ غير معروف — راجع سجل التدقيق',
                inline: true,
            }, {
                name: '📌 حالة البوت الآن',
                value: `أعلى رتبة: **${s.botRoleName}** — الموقع \`#${s.botPosition}\``,
                inline: true,
            }, {
                name: `⛔ الرولات فوق البوت (${s.offenderCount})`,
                value: s.offenders.join('\n') || '—',
                inline: false,
            }, {
                name: '✅ أعدّها الآن (خطوتين)',
                value: '**1.** Server Settings ← Roles\n' +
                    `**2.** اسحب رول البوت (‎${s.botRoleName}‎) **لأعلى القائمة** تحت @everyone مباشرة\n\n` +
                    '_بعد التصحيح يرسل البوت رسالة تأكيد بأن الحماية رجعت تعمل._',
                inline: false,
            })
                .setFooter({ text: 'Liberty City — Hierarchy Guard' })
                .setTimestamp();
            if (channel) {
                await channel.send({ embeds: [embed], content: `<@${guild.ownerId}>` }).catch(() => { });
            }
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
            //    (مضاد النيوك + الاستعادة التلقائية + العقوبات تفشل فجأة بلا سبب ظاهر)
            const me = newRole.guild.members.me;
            if (me &&
                me.roles.cache.has(newRole.id) &&
                newRole.position < oldRole.position &&
                !this.checkHierarchy(newRole.guild).ok) {
                await this.announceBotDemotion(newRole.guild, oldRole, newRole);
            }
            const gainedAdmin = !oldRole.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) &&
                newRole.permissions.has(discord_js_1.PermissionFlagsBits.Administrator);
            if (!gainedAdmin)
                return;
            const settings = await (0, models_1.getGuildSettings)(newRole.guild.id);
            const cfg = settings.protection?.antiAdmin;
            if (!cfg?.enabled)
                return;
            const isEveryone = newRole.id === newRole.guild.id;
            const executor = await this.findExecutor(newRole.guild, discord_js_1.AuditLogEvent.RoleUpdate, newRole.id);
            let actionText = '📢 تم الإشعار فقط';
            if (executor && cfg.action === 'kick') {
                actionText = await this.punish(newRole.guild, executor, 'kick', 'Liberty City Anti-Admin: منح صلاحية Administrator بدون إذن');
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`⚠️ منح صلاحية Administrator${isEveryone ? ' لـ @everyone' : ''}!`)
                .setDescription(isEveryone
                ? '**تغيير خطير:** مُنحت صلاحية Administrator لـ @everyone — أي عضو يصبح يملك تحكماً كاملاً في السيرفر!'
                : `مُنحت صلاحية Administrator للرول ${newRole}`)
                .setColor(embeds_1.Colors.error)
                .addFields({ name: 'المنفّذ', value: executor ? `${executor} (\`${executor.tag}\`)` : 'غير معروف', inline: true }, { name: 'الإجراء', value: actionText, inline: true }, {
                name: '🔔 التوصية',
                value: 'راجع الصلاحيات فوراً — إن لم تكن أنت من فعلها، احذف الصلاحية واستخدم `/backup restore` للرولات',
                inline: false,
            })
                .setFooter({ text: 'Liberty City Anti-Admin' })
                .setTimestamp();
            const channel = await this.getAlertChannel(newRole.guild, settings, cfg.logChannel);
            if (channel)
                await channel.send({ embeds: [embed] }).catch(() => { });
            logger.warn(`⚠️ Anti-Admin: Administrator granted to ${isEveryone ? '@everyone' : newRole.name} in ${newRole.guild.name} | ${actionText}`);
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
    // إنشاء نسخة احتياطية (بنية القنوات + الرولات)
    async createBackup(guild) {
        // نمط المشبوه — لا يُحفظ في النسخة الاحتياطية
        const SUSPICIOUS = /nuked|hacked|kly|rcl|cracked|death.?note|pwned|owned|here|on.?top|spam|raid|destroy|test.?123|vxl.?hak/i;
        const channels = guild.channels.cache
            .filter(c => !c.isThread() && !SUSPICIOUS.test(c.name))
            .map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            position: 'position' in c ? c.position : 0,
            topic: c.topic ?? null,
            parentId: c.parentId ?? null,
            nsfw: c.nsfw ?? false,
            rateLimitPerUser: c.rateLimitPerUser ?? 0,
        }))
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
        // 1) الرولات أولاً — استراتيجية الصمت: لو اتحددنا نوقف تماماً 30 دقيقة
        let rateLimitStrikes = 0;
        for (const rd of data.roles || []) {
            if (SUSPICIOUS_PATTERN.test(rd.name)) {
                result.skipped++;
                continue;
            }
            const exists = guild.roles.cache.get(rd.id) ||
                guild.roles.cache.find(r => r.name === rd.name && r.id !== guild.id);
            if (exists) {
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
                    rateLimitStrikes = 0; // reset strikes on success
                }
                catch (error) {
                    const isRateLimit = error?.status === 429 ||
                        error?.httpStatus === 429 ||
                        /rate limit|too many/i.test(error?.message || '');
                    if (isRateLimit) {
                        rateLimitStrikes++;
                        const retryAfter = error?.retry_after ?? error?.data?.retry_after ?? 60;
                        if (rateLimitStrikes >= 2) {
                            // محاولة ثالثة = صمت كامل 30 دقيقة
                            logger.warn(`restore role "${rd.name}" — strike ${rateLimitStrikes}, full silence 30min`);
                            await sleep(30 * 60 * 1000);
                            rateLimitStrikes = 0;
                        }
                        else {
                            const waitMs = Math.min((Number(retryAfter) || 60) * 1000 + 3000, 700000);
                            logger.warn(`restore role "${rd.name}" — RL, waiting ${Math.round(waitMs / 1000)}s`);
                            await sleep(waitMs);
                        }
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
        // 1.5) إعادة ترتيب الرولات حسب النسخة الاحتياطية
        if (result.roles > 0) {
            try {
                await sleep(2000);
                const curRoles = await guild.roles.fetch();
                const nameToId = {};
                for (const [, role] of curRoles) {
                    if (role.managed || role.id === guild.id)
                        continue;
                    nameToId[role.name] = role.id;
                }
                // الترتيب: الأعلى position في النسخة = رقم position الأعلى في السيرفر
                const backupSorted = [...(data.roles || [])].sort((a, b) => (b.position || 0) - (a.position || 0));
                const positions = [];
                let pos = backupSorted.length;
                for (const rd of backupSorted) {
                    const id = nameToId[rd.name];
                    if (id) {
                        positions.push({ role: id, position: pos });
                        pos--;
                    }
                }
                if (positions.length > 1) {
                    await guild.roles.setPositions(positions);
                    logger.info(`📐 Reordered ${positions.length} roles to match backup`);
                }
            }
            catch (error) {
                logger.warn(`Role reorder failed: ${error.message}`);
            }
        }
        // 2) القنوات (الفئات أولاً ثم حسب الترتيب)
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
                if (typeof cd.position === 'number' && cd.position > 0) {
                    await created.setPosition(cd.position).catch(() => { });
                }
            }
            catch (error) {
                logger.warn(`restore channel "${cd.name}" failed: ${error.message}`);
                result.skipped++;
            }
            await sleep(700);
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