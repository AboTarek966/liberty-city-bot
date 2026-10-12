"use strict";
// ============================================
// Liberty City Bot - Moderation Handler
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationHandler = void 0;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const models_1 = require("../models");
const embeds_1 = require("../utils/embeds");
const helpers_2 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('ModerationHandler');
// --------------------------------------------
// Moderation Handler Class
// --------------------------------------------
class ModerationHandler {
    client;
    constructor(client) {
        this.client = client;
    }
    // --------------------------------------------
    // Ban
    // --------------------------------------------
    async ban(options) {
        const { guild, moderator, target, reason, proof } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        // Check permissions
        if (targetMember && !this.canModerate(moderator, targetMember)) {
            throw new Error('لا يمكنك حظر هذا العضو');
        }
        // ⚡ رقم الكيس يُجلب بالتوازي مع عملية الحظر لتقليل زمن الرد
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        // Ban the user
        await guild.members.ban(target.id, {
            reason,
            deleteMessageSeconds: 0,
        });
        const caseId = await caseIdPromise;
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'ban',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            proof,
        });
        // ⚡ كل ما لا يؤثر على الرد يعمل في الخلفية (الكيس، رسالة خاصة، سجل الإشراف)
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'ban',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            proof,
            active: true,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '🔨 تم حظرك',
            description: `تم حظرك من **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.error,
        });
        void this.logAction(guild, embed);
        logger.info(`Banned ${target.id} from ${guild.id} by ${moderator.id}`);
        return { case: null, embed };
    }
    // --------------------------------------------
    // Kick
    // --------------------------------------------
    async kick(options) {
        const { guild, moderator, target, reason } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        if (!targetMember) {
            throw new Error('لم يتم العثور على العضو');
        }
        if (!this.canModerate(moderator, targetMember)) {
            throw new Error('لا يمكنك طرد هذا العضو');
        }
        // ⚡ رقم الكيس بالتوازي مع عملية الطرد
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        // Kick the member
        await targetMember.kick(reason);
        const caseId = await caseIdPromise;
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'kick',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'kick',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: true,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '👢 تم طردك',
            description: `تم طردك من **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.error,
        });
        void this.logAction(guild, embed);
        logger.info(`Kicked ${target.id} from ${guild.id} by ${moderator.id}`);
        return { case: null, embed };
    }
    // --------------------------------------------
    // Timeout
    // --------------------------------------------
    async timeout(options) {
        const { guild, moderator, target, reason, duration } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        if (!targetMember) {
            throw new Error('لم يتم العثور على العضو');
        }
        if (!this.canModerate(moderator, targetMember)) {
            throw new Error('لا يمكنك كتم هذا العضو');
        }
        // Parse duration
        const durationMs = duration ? (0, helpers_1.parseDuration)(duration) : 600000; // Default 10 minutes
        if (!durationMs || durationMs <= 0 || durationMs > 28 * 24 * 60 * 60 * 1000) {
            throw new Error('مدة غير صالحة (الحد الأقصى 28 يوم)');
        }
        // ⚡ رقم الكيس بالتوازي مع عملية الكتم
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        // Timeout the member
        await targetMember.timeout(durationMs, reason);
        const caseId = await caseIdPromise;
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'timeout',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            duration: (0, helpers_1.formatDuration)(durationMs),
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'timeout',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            duration: durationMs,
            expiresAt: new Date(Date.now() + durationMs),
            active: true,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '⏱️ تم كتمك',
            description: `تم كتمك في **${guild.name}**\n\n**المدة:** ${(0, helpers_1.formatDuration)(durationMs)}\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.warning,
        });
        void this.logAction(guild, embed);
        logger.info(`Timed out ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: null, embed };
    }
    // --------------------------------------------
    // Remove Timeout
    // --------------------------------------------
    async removeTimeout(options) {
        const { guild, moderator, target, reason } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        if (!targetMember) {
            throw new Error('لم يتم العثور على العضو');
        }
        if (!this.canModerate(moderator, targetMember)) {
            throw new Error('لا يمكنك إلغاء كتم هذا العضو');
        }
        // ⚡ رقم الكيس بالتوازي مع إلغاء الكتم
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        // Remove timeout
        await targetMember.timeout(null, reason);
        const caseId = await caseIdPromise;
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'untimeout',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'untimeout',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '▶️ تم إلغاء كتمك',
            description: `تم إلغاء كتمك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.success,
        });
        void this.logAction(guild, embed);
        logger.info(`Removed timeout for ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: null, embed };
    }
    // --------------------------------------------
    // Warn
    // --------------------------------------------
    async warn(options) {
        const { guild, moderator, target, reason } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        if (!this.canModerate(moderator, targetMember || target)) {
            throw new Error('لا يمكنك تحذير هذا العضو');
        }
        // ⚡ عدّ التحذيرات + رقم الكيس بالتوازي (استعلامان في وقت واحد بدل متتاليين)
        const [warningCount, caseId] = await Promise.all([
            models_1.Warning.countDocuments({ guildId: guild.id, userId: target.id }),
            (0, models_1.getNextCaseId)(guild.id),
        ]);
        // سجل التحذير (ضروري لعملية unwarn) — يبقى متزامناً
        await models_1.Warning.create({
            guildId: guild.id,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
            caseId,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'warn',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // ⚡ كل ما لا يؤثر على الرد يعمل في الخلفية
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'warn',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: true,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '⚠️ تحذير',
            description: `تم تحذيرك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**عدد التحذيرات:** ${warningCount + 1}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.warning,
        });
        void this.logAction(guild, embed);
        // Check if should auto-mute/ban at threshold
        void this.checkWarningThreshold(guild, target.id, warningCount + 1);
        logger.info(`Warned ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: null, embed, warningCount: warningCount + 1 };
    }
    // --------------------------------------------
    // Unwarn (إزالة تحذير)
    // --------------------------------------------
    async unwarn(options) {
        const { guild, moderator, target, reason } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        // ⚡ العدّ + آخر تحذير + رقم الكيس كلها بالتوازي
        const [warningCount, latest, caseId] = await Promise.all([
            models_1.Warning.countDocuments({ guildId: guild.id, userId: target.id }),
            models_1.Warning.findOne({ guildId: guild.id, userId: target.id }).sort({ createdAt: -1 }),
            (0, models_1.getNextCaseId)(guild.id),
        ]);
        if (warningCount === 0) {
            throw new Error('هذا العضو ليس لديه أي تحذيرات');
        }
        // إزالة أحدث تحذير
        if (latest) {
            await models_1.Warning.findByIdAndDelete(latest._id);
        }
        const remaining = Math.max(0, warningCount - 1);
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'unwarn',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'unwarn',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '✅ إزالة تحذير',
            description: `تم إزالة أحد تحذيراتك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**التحذيرات المتبقية:** ${remaining}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.success,
        });
        void this.logAction(guild, embed);
        logger.info(`Unwarned ${target.id} in ${guild.id} by ${moderator.id} (remaining: ${remaining})`);
        return { case: null, embed, warningCount: remaining };
    }
    // --------------------------------------------
    // Check Warning Threshold
    // --------------------------------------------
    async checkWarningThreshold(guild, userId, warningCount) {
        // Default thresholds: 5 warnings = kick, 10 warnings = ban
        const kickThreshold = 5;
        const banThreshold = 10;
        try {
            const member = guild.members.cache.get(userId);
            if (!member)
                return;
            if (warningCount >= banThreshold) {
                await guild.members.ban(userId, {
                    reason: `Auto-ban: Reached ${banThreshold} warnings`,
                    deleteMessageSeconds: 0,
                });
                logger.info(`Auto-banned ${userId} for reaching ${banThreshold} warnings`);
            }
            else if (warningCount >= kickThreshold) {
                await member.kick(`Auto-kick: Reached ${kickThreshold} warnings`);
                logger.info(`Auto-kicked ${userId} for reaching ${kickThreshold} warnings`);
            }
        }
        catch (error) {
            logger.error('Failed to check warning threshold:', error);
        }
    }
    // --------------------------------------------
    // Mute (Role-based)
    // --------------------------------------------
    async mute(options) {
        const { guild, moderator, target, reason, duration } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        if (!targetMember) {
            throw new Error('لم يتم العثور على العضو');
        }
        if (!this.canModerate(moderator, targetMember)) {
            throw new Error('لا يمكنك كتم هذا العضو');
        }
        // ⚡ رقم الكيس بالتوازي مع إضافة رول الكتم
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        // Get or create mute role
        let muteRole = await this.getMuteRole(guild);
        // Add mute role
        await targetMember.roles.add(muteRole, reason);
        const caseId = await caseIdPromise;
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'mute',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            duration,
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'mute',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            duration: duration ? (0, helpers_1.parseDuration)(duration) || undefined : undefined,
            active: true,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '🔇 تم كتمك',
            description: `تم كتمك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.warning,
        });
        void this.logAction(guild, embed);
        logger.info(`Muted ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: null, embed, simpleMsg: `🔇 **${target instanceof discord_js_1.GuildMember ? target.user.tag : target.tag}** تم كتمه${duration ? ` لمدة ${duration}` : ''} | ${reason}` };
    }
    // --------------------------------------------
    // Unmute
    // --------------------------------------------
    async unmute(options) {
        const { guild, moderator, target, reason } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        if (!targetMember) {
            throw new Error('لم يتم العثور على العضو');
        }
        if (!this.canModerate(moderator, targetMember)) {
            throw new Error('لا يمكنك إلغاء كتم هذا العضو');
        }
        // ⚡ رقم الكيس بالتوازي مع إزالة رول الكتم
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        // Get mute role
        const muteRole = await this.getMuteRole(guild);
        if (!muteRole) {
            throw new Error('لا يوجد رول كتم');
        }
        // Remove mute role
        await targetMember.roles.remove(muteRole, reason);
        const caseId = await caseIdPromise;
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'unmute',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'unmute',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.sendDM(target, {
            title: '🔊 تم إلغاء كتمك',
            description: `تم إلغاء كتمك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.success,
        });
        void this.logAction(guild, embed);
        logger.info(`Unmuted ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: null, embed, simpleMsg: `🔊 **${target instanceof discord_js_1.GuildMember ? target.user.tag : target.tag}** تم فك الكتم عنه | ${reason}` };
    }
    // --------------------------------------------
    // Add Role (إضافة رول)
    // --------------------------------------------
    async addRole(options) {
        const { guild, moderator, target, reason, roleId } = options;
        const role = guild.roles.cache.get(roleId);
        if (!role)
            throw new Error('الرول غير موجود');
        if (!this.canModerate(moderator, target)) {
            throw new Error('لا يمكنك إضافة رول لهذا العضو');
        }
        if (target.roles.cache.has(role.id)) {
            throw new Error(`العضو يملك رول ${role.name} بالفعل`);
        }
        const isOwner = moderator.id === guild.ownerId;
        if (!isOwner && moderator.roles.highest.comparePositionTo(role) <= 0) {
            throw new Error('رتبتك يجب أن تكون أعلى من الرول المضاف');
        }
        if (guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
            throw new Error('رتبة البوت يجب أن تكون أعلى من الرول المضاف');
        }
        // ⚡ رقم الكيس بالتوازي مع إضافة الرول
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        await target.roles.add(role, `${reason} | بواسطة ${moderator.user.tag}`);
        const caseId = await caseIdPromise;
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'role_add',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            extraFields: [{ name: 'الرول', value: `${role}`, inline: true }],
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'role_add',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.logAction(guild, embed);
        logger.info(`Added role ${roleId} to ${target.id} by ${moderator.id}`);
        return {
            case: null,
            embed,
            simpleMsg: `✅ **تم إضافة رول ${role} للعضو ${target} من قبل ${moderator}**`,
        };
    }
    // --------------------------------------------
    // Add Roles (إضافة أكثر من رول في مرة واحدة)
    // --------------------------------------------
    async addRoles(options) {
        const { guild, moderator, target, reason, roleIds } = options;
        if (!this.canModerate(moderator, target)) {
            throw new Error('لا يمكنك إضافة رول لهذا العضو');
        }
        if (!roleIds.length) {
            throw new Error('لم يتم تحديد أي رول');
        }
        const isOwner = moderator.id === guild.ownerId;
        const toAdd = [];
        const skipped = [];
        for (const roleId of roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (!role) {
                skipped.push('رول غير موجود');
                continue;
            }
            if (target.roles.cache.has(role.id)) {
                skipped.push(`${role.name} (مملوك بالفعل)`);
                continue;
            }
            if (role.managed) {
                skipped.push(`${role.name} (مُدار)`);
                continue;
            }
            if (!isOwner && moderator.roles.highest.comparePositionTo(role) <= 0) {
                skipped.push(`${role.name} (أعلى من رتبتك)`);
                continue;
            }
            if (guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
                skipped.push(`${role.name} (أعلى من رتبة البوت)`);
                continue;
            }
            toAdd.push(role.id);
        }
        if (!toAdd.length) {
            if (skipped.length && skipped.every(s => s.includes('مملوك بالفعل'))) {
                throw new Error('العضو يملك هذه الرولات بالفعل');
            }
            throw new Error(`لا يمكن إعطاء أي رول:\n${skipped.slice(0, 6).map(s => `• ${s}`).join('\n')}`);
        }
        // ⚡ رقم الكيس بالتوازي مع إضافة الرولات
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        await target.roles.add(toAdd, `${reason} | بواسطة ${moderator.user.tag}`);
        const caseId = await caseIdPromise;
        const addedRoles = toAdd.map(id => guild.roles.cache.get(id)).filter(Boolean);
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'role_add',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            extraFields: [
                {
                    name: addedRoles.length > 1 ? 'الرولات' : 'الرول',
                    value: addedRoles.map(r => `${r}`).join(', '),
                    inline: false,
                },
                ...(skipped.length
                    ? [{ name: 'تم تخطيها', value: skipped.slice(0, 10).join('\n'), inline: false }]
                    : []),
            ],
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'role_add',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.logAction(guild, embed);
        logger.info(`Added ${toAdd.length} role(s) to ${target.id} by ${moderator.id}`);
        return {
            case: null,
            embed,
            simpleMsg: `✅ **تم إضافة ${toAdd.length} رول للعضو ${target} من قبل ${moderator}**`,
            added: toAdd,
            skipped,
        };
    }
    // --------------------------------------------
    // Remove Role (إزالة رول)
    // --------------------------------------------
    async removeRole(options) {
        const { guild, moderator, target, reason, roleId } = options;
        const role = guild.roles.cache.get(roleId);
        if (!role)
            throw new Error('الرول غير موجود');
        if (!this.canModerate(moderator, target)) {
            throw new Error('لا يمكنك إزالة رول من هذا العضو');
        }
        if (!target.roles.cache.has(role.id)) {
            throw new Error(`العضو لا يملك رول ${role.name}`);
        }
        const isOwner = moderator.id === guild.ownerId;
        if (!isOwner && moderator.roles.highest.comparePositionTo(role) <= 0) {
            throw new Error('رتبتك يجب أن تكون أعلى من الرول المراد إزالتها');
        }
        if (guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
            throw new Error('رتبة البوت يجب أن تكون أعلى من الرول المراد إزالتها');
        }
        // ⚡ رقم الكيس بالتوازي مع إزالة الرول
        const caseIdPromise = (0, models_1.getNextCaseId)(guild.id);
        await target.roles.remove(role, `${reason} | بواسطة ${moderator.user.tag}`);
        const caseId = await caseIdPromise;
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'role_remove',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            extraFields: [{ name: 'الرول', value: `${role}`, inline: true }],
        });
        // ⚡ في الخلفية — لا يؤخر الرد
        void models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'role_remove',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        }).catch(err => logger.warn(`Case create failed: ${err.message}`));
        void this.logAction(guild, embed);
        logger.info(`Removed role ${roleId} from ${target.id} by ${moderator.id}`);
        return {
            case: null,
            embed,
            simpleMsg: `✅ **تم إزالة رول ${role} من العضو ${target} من قبل ${moderator}**`,
        };
    }
    // --------------------------------------------
    // Get or Create Mute Role
    // --------------------------------------------
    async getMuteRole(guild) {
        // Try to find existing
        let muteRoleData = await models_1.MuteRole.findOne({ guildId: guild.id });
        if (muteRoleData) {
            const role = guild.roles.cache.get(muteRoleData.roleId);
            if (role)
                return role;
        }
        // Create new mute role
        const role = await (0, helpers_2.createMuteRole)(guild);
        // Apply permissions to all channels
        await (0, helpers_2.applyMuteRole)(guild, role);
        // Save to database
        muteRoleData = await models_1.MuteRole.findOneAndUpdate({ guildId: guild.id }, { roleId: role.id }, { upsert: true, new: true });
        return role;
    }
    // --------------------------------------------
    // Get Warnings
    // --------------------------------------------
    async getWarnings(guildId, userId) {
        return models_1.Warning.find({ guildId, userId }).sort({ createdAt: -1 });
    }
    // --------------------------------------------
    // Remove Warning
    // --------------------------------------------
    async removeWarning(guildId, userId, warningId) {
        const query = { guildId, userId };
        if (warningId)
            query._id = warningId;
        const result = await models_1.Warning.deleteMany(query);
        return result.deletedCount;
    }
    // --------------------------------------------
    // Get Moderation Cases
    // --------------------------------------------
    async getCases(guildId, options = {}) {
        const query = { guildId };
        if (options.userId)
            query.targetId = options.userId;
        if (options.moderatorId)
            query.moderatorId = options.moderatorId;
        if (options.type)
            query.type = options.type;
        return models_1.ModerationCase.find(query)
            .sort({ createdAt: -1 })
            .limit(options.limit || 50);
    }
    // --------------------------------------------
    // Helper Methods
    // --------------------------------------------
    canModerate(moderator, target) {
        if (!(target instanceof discord_js_1.GuildMember))
            return true; // Can always moderate users not in guild
        if (moderator.id === target.id)
            return false;
        if (moderator.id === moderator.guild.ownerId)
            return true;
        if (target.id === target.guild.ownerId)
            return false;
        return moderator.roles.highest.position > target.roles.highest.position;
    }
    async sendDM(user, data) {
        try {
            const userObj = user instanceof discord_js_1.GuildMember ? user.user : user;
            await userObj.send({
                embeds: [(0, embeds_1.createEmbed)(data)],
            });
        }
        catch (error) {
            // DMs might be closed
            logger.debug(`Failed to send DM to ${user.id}`);
        }
    }
    async logAction(guild, embed) {
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            if (!settings.logging?.enabled || !settings.logging.channelId)
                return;
            const logChannel = guild.channels.cache.get(settings.logging.channelId);
            if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
                return;
            await logChannel.send({ embeds: [embed] });
        }
        catch (error) {
            logger.error('Failed to log moderation action:', error);
        }
    }
}
exports.ModerationHandler = ModerationHandler;
exports.default = ModerationHandler;
//# sourceMappingURL=ModerationHandler.js.map