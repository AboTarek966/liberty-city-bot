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
class SecurityHandler {
    client;
    // تتبّع عمليات الحذف: guildId → { نوع → توقيتات }
    deletionTracker = new Map();
    // مؤقتات النسخ الاحتياطي التلقائي
    backupTimers = new Map();
    constructor(client) {
        this.client = client;
    }
    cleanup() {
        for (const timer of this.backupTimers.values())
            clearInterval(timer);
        this.backupTimers.clear();
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
    async punish(guild, executor, action, reason) {
        if (executor.id === guild.ownerId)
            return '⏭️ المالك مستثناً';
        if (executor.id === this.client.user?.id)
            return '⏭️ البوت مستثنى';
        const member = guild.members.cache.get(executor.id) ||
            (await guild.members.fetch(executor.id).catch(() => null));
        if (!member)
            return '⚠️ المخالف لم يعد عضواً';
        try {
            if (action === 'ban') {
                await member.ban({ reason });
                return '🔨 تم حظر المخالف';
            }
            if (action === 'kick') {
                await member.kick(reason);
                return '👢 تم طرد المخالف';
            }
        }
        catch (error) {
            logger.warn(`punish failed (${action}) in ${guild.name}: ${error.message}`);
            return `⚠️ فشل التنفيذ (${error.message})`;
        }
        return '📢 تم الإشعار فقط';
    }
    // تتبّع الحذف → يعيد العدد داخل النافذة الزمنية
    track(guildId, type, windowMs) {
        const now = Date.now();
        let tracker = this.deletionTracker.get(guildId);
        if (!tracker) {
            tracker = { channel: [], role: [], ban: [] };
            this.deletionTracker.set(guildId, tracker);
        }
        tracker[type].push(now);
        tracker[type] = tracker[type].filter(t => now - t <= windowMs);
        return tracker[type].length;
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
    async respondMassDeletion(guild, settings, cfg, type, auditType, targetId) {
        const labels = {
            channel: { emoji: '📢', label: 'قنوات' },
            role: { emoji: '🎭', label: 'رولات' },
            ban: { emoji: '🔨', label: 'حظر جماعي' },
        };
        const executor = await this.findExecutor(guild, auditType, targetId);
        const windowSec = Math.round((cfg.timeWindow ?? 10000) / 1000);
        let actionText;
        if (executor) {
            actionText = await this.punish(guild, executor, cfg.action ?? 'kick', `Liberty City Anti-Nuke: حذف مكثف (${labels[type].label})`);
        }
        else {
            actionText = '⚠️ تعذّر تحديد المنفّذ من سجلات التدقيق';
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🚨 تحذير أمني — هجوم حذف مكثف!`)
            .setDescription(`${labels[type].emoji} تم حذف **${labels[type].label}** بشكل مكثف خلال ${windowSec} ثانية — هذا نمط هجوم "نيوك" على السيرفر!`)
            .setColor(embeds_1.Colors.error)
            .addFields({ name: 'المخالف', value: executor ? `${executor} (\`${executor.tag}\`)` : 'غير معروف', inline: true }, { name: 'الإجراء المتخذ', value: actionText, inline: true }, {
            name: '🔔 التوصية',
            value: 'إن استُمر الحذف: استخدم `/backup restore` لاستعادة بنية السيرفر من آخر نسخة احتياطية',
            inline: false,
        })
            .setFooter({ text: 'Liberty City Anti-Nuke' })
            .setTimestamp();
        const channel = await this.getAlertChannel(guild, settings, settings?.protection?.antiNuke?.logChannel);
        if (channel) {
            await channel.send({ embeds: [embed], content: executor ? `<@${guild.ownerId}>` : undefined }).catch(() => { });
        }
        logger.warn(`🚨 Anti-Nuke: ${type} x${cfg.threshold} in ${guild.name} | executor=${executor?.tag ?? 'unknown'} | ${actionText}`);
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
    async onRoleUpdate(oldRole, newRole) {
        try {
            if (!newRole.guild)
                return;
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
        const channels = guild.channels.cache
            .filter(c => !c.isThread())
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
            .filter(r => r.id !== guild.id && !r.managed)
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
    async restoreBackup(guild, backupIndex) {
        const doc = await models_1.BackupConfig.findOne({ guildId: guild.id });
        if (!doc?.backups?.length)
            throw new Error('لا توجد نسخ احتياطية — أنشئ واحدة أولاً بـ `/backup create`');
        const backup = backupIndex === undefined ? doc.backups[doc.backups.length - 1] : doc.backups[backupIndex];
        if (!backup)
            throw new Error('رقم النسخة غير صحيح — استخدم `/backup list`');
        const data = backup.data;
        const result = { channels: 0, roles: 0, skipped: 0 };
        const idMap = {};
        // 1) الرولات أولاً
        for (const rd of data.roles || []) {
            const exists = guild.roles.cache.get(rd.id) ||
                guild.roles.cache.find(r => r.name === rd.name && r.id !== guild.id);
            if (exists) {
                result.skipped++;
                continue;
            }
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
            }
            catch (error) {
                logger.warn(`restore role "${rd.name}" failed: ${error.message}`);
                result.skipped++;
            }
            await sleep(700);
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