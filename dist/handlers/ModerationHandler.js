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
        // Ban the user
        await guild.members.ban(target.id, {
            reason,
            deleteMessageSeconds: 0,
        });
        // Create case
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'ban',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            proof,
            active: true,
        });
        // Send DM to user
        await this.sendDM(target, {
            title: '🔨 تم حظرك',
            description: `تم حظرك من **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.error,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'ban',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            proof,
        });
        // Log to mod logs
        await this.logAction(guild, embed);
        logger.info(`Banned ${target.id} from ${guild.id} by ${moderator.id}`);
        return { case: moderationCase, embed };
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
        // Kick the member
        await targetMember.kick(reason);
        // Create case
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'kick',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: true,
        });
        // Send DM
        await this.sendDM(target, {
            title: '👢 تم طردك',
            description: `تم طردك من **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.error,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'kick',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // Log
        await this.logAction(guild, embed);
        logger.info(`Kicked ${target.id} from ${guild.id} by ${moderator.id}`);
        return { case: moderationCase, embed };
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
        // Timeout the member
        await targetMember.timeout(durationMs, reason);
        // Create case
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'timeout',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            duration: durationMs,
            expiresAt: new Date(Date.now() + durationMs),
            active: true,
        });
        // Send DM
        await this.sendDM(target, {
            title: '⏱️ تم كتمك',
            description: `تم كتمك في **${guild.name}**\n\n**المدة:** ${(0, helpers_1.formatDuration)(durationMs)}\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.warning,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'timeout',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            duration: (0, helpers_1.formatDuration)(durationMs),
        });
        // Log
        await this.logAction(guild, embed);
        logger.info(`Timed out ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: moderationCase, embed };
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
        // Remove timeout
        await targetMember.timeout(null, reason);
        // Create case
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'untimeout',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        });
        // Send DM
        await this.sendDM(target, {
            title: '▶️ تم إلغاء كتمك',
            description: `تم إلغاء كتمك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.success,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'untimeout',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // Log
        await this.logAction(guild, embed);
        logger.info(`Removed timeout for ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: moderationCase, embed };
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
        // Get warning count
        const warningCount = await models_1.Warning.countDocuments({
            guildId: guild.id,
            userId: target.id,
        });
        // Create case
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'warn',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: true,
        });
        // Create warning record
        await models_1.Warning.create({
            guildId: guild.id,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
            caseId,
        });
        // Send DM
        await this.sendDM(target, {
            title: '⚠️ تحذير',
            description: `تم تحذيرك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**عدد التحذيرات:** ${warningCount + 1}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.warning,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'warn',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // Log
        await this.logAction(guild, embed);
        // Check if should auto-mute/ban at threshold
        await this.checkWarningThreshold(guild, target.id, warningCount + 1);
        logger.info(`Warned ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: moderationCase, embed, warningCount: warningCount + 1 };
    }
    // --------------------------------------------
    // Unwarn (إزالة تحذير)
    // --------------------------------------------
    async unwarn(options) {
        const { guild, moderator, target, reason } = options;
        const targetMember = target instanceof discord_js_1.GuildMember ? target : guild.members.cache.get(target.id);
        const warningCount = await models_1.Warning.countDocuments({
            guildId: guild.id,
            userId: target.id,
        });
        if (warningCount === 0) {
            throw new Error('هذا العضو ليس لديه أي تحذيرات');
        }
        // إزالة أحدث تحذير
        const latest = await models_1.Warning.findOne({ guildId: guild.id, userId: target.id })
            .sort({ createdAt: -1 });
        if (latest) {
            await models_1.Warning.findByIdAndDelete(latest._id);
        }
        const remaining = Math.max(0, warningCount - 1);
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'unwarn',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        });
        await this.sendDM(target, {
            title: '✅ إزالة تحذير',
            description: `تم إزالة أحد تحذيراتك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**التحذيرات المتبقية:** ${remaining}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.success,
        });
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'unwarn',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        await this.logAction(guild, embed);
        logger.info(`Unwarned ${target.id} in ${guild.id} by ${moderator.id} (remaining: ${remaining})`);
        return { case: moderationCase, embed, warningCount: remaining };
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
        // Get or create mute role
        let muteRole = await this.getMuteRole(guild);
        // Add mute role
        await targetMember.roles.add(muteRole, reason);
        // Create case
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'mute',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            duration: duration ? (0, helpers_1.parseDuration)(duration) || undefined : undefined,
            active: true,
        });
        // Send DM
        await this.sendDM(target, {
            title: '🔇 تم كتمك',
            description: `تم كتمك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.warning,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'mute',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            duration,
        });
        // Log
        await this.logAction(guild, embed);
        logger.info(`Muted ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: moderationCase, embed };
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
        // Get mute role
        const muteRole = await this.getMuteRole(guild);
        if (!muteRole) {
            throw new Error('لا يوجد رول كتم');
        }
        // Remove mute role
        await targetMember.roles.remove(muteRole, reason);
        // Create case
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'unmute',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        });
        // Send DM
        await this.sendDM(target, {
            title: '🔊 تم إلغاء كتمك',
            description: `تم إلغاء كتمك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
            color: embeds_1.Colors.success,
        });
        // Create embed
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'unmute',
            moderator: moderator.user,
            target,
            reason,
            caseId,
        });
        // Log
        await this.logAction(guild, embed);
        logger.info(`Unmuted ${target.id} in ${guild.id} by ${moderator.id}`);
        return { case: moderationCase, embed };
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
        await target.roles.add(role, `${reason} | بواسطة ${moderator.user.tag}`);
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'role_add',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        });
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'role_add',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            extraFields: [{ name: 'الرول', value: `${role}`, inline: true }],
        });
        await this.logAction(guild, embed);
        logger.info(`Added role ${roleId} to ${target.id} by ${moderator.id}`);
        return {
            case: moderationCase,
            embed,
            simpleMsg: `✅ **تم إضافة رول ${role} للعضو ${target} من قبل ${moderator}**`,
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
        await target.roles.remove(role, `${reason} | بواسطة ${moderator.user.tag}`);
        const caseId = await (0, models_1.getNextCaseId)(guild.id);
        const moderationCase = await models_1.ModerationCase.create({
            guildId: guild.id,
            caseId,
            type: 'role_remove',
            moderatorId: moderator.id,
            targetId: target.id,
            reason,
            active: false,
        });
        const embed = (0, embeds_1.moderationEmbed)({
            type: 'role_remove',
            moderator: moderator.user,
            target,
            reason,
            caseId,
            extraFields: [{ name: 'الرول', value: `${role}`, inline: true }],
        });
        await this.logAction(guild, embed);
        logger.info(`Removed role ${roleId} from ${target.id} by ${moderator.id}`);
        return {
            case: moderationCase,
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