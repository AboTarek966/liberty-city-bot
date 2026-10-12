// ============================================
// Liberty City Bot - Moderation Handler
// ============================================

import {
  Client,
  Guild,
  GuildMember,
  User,
  Role,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  ColorResolvable,
} from 'discord.js';
import { createLogger, parseDuration, formatDuration } from '../utils/helpers';
import {
  getGuildSettings,
  ModerationCase,
  Warning,
  MuteRole,
  getNextCaseId,
} from '../models';
import { moderationEmbed, createEmbed, Colors } from '../utils/embeds';
import { createMuteRole, applyMuteRole } from '../utils/helpers';

const logger = createLogger('ModerationHandler');

// --------------------------------------------
// Types
// --------------------------------------------
export type ModerationAction = 
  | 'ban' 
  | 'kick' 
  | 'mute' 
  | 'unmute' 
  | 'warn' 
  | 'unwarn' 
  | 'timeout' 
  | 'untimeout' 
  | 'softban' 
  | 'note';

export interface ModerationOptions {
  guild: Guild;
  moderator: GuildMember;
  target: GuildMember | User;
  reason: string;
  duration?: string;
  proof?: string;
}

// --------------------------------------------
// Moderation Handler Class
// --------------------------------------------
export class ModerationHandler {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  // --------------------------------------------
  // Ban
  // --------------------------------------------
  async ban(options: ModerationOptions): Promise<{ case: any; embed: any }> {
    const { guild, moderator, target, reason, proof } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    // Check permissions
    if (targetMember && !this.canModerate(moderator, targetMember)) {
      throw new Error('لا يمكنك حظر هذا العضو');
    }

    // ⚡ رقم الكيس يُجلب بالتوازي مع عملية الحظر لتقليل زمن الرد
    const caseIdPromise = getNextCaseId(guild.id);

    // Ban the user
    await guild.members.ban(target.id, {
      reason,
      deleteMessageSeconds: 0,
    });

    const caseId = await caseIdPromise;

    // Create embed
    const embed = moderationEmbed({
      type: 'ban',
      moderator: moderator.user,
      target,
      reason,
      caseId,
      proof,
    });

    // ⚡ كل ما لا يؤثر على الرد يعمل في الخلفية (الكيس، رسالة خاصة، سجل الإشراف)
    void ModerationCase.create({
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
      color: Colors.error,
    });

    void this.logAction(guild, embed);

    logger.info(`Banned ${target.id} from ${guild.id} by ${moderator.id}`);
    return { case: null, embed };
  }

  // --------------------------------------------
  // Kick
  // --------------------------------------------
  async kick(options: ModerationOptions): Promise<{ case: any; embed: any }> {
    const { guild, moderator, target, reason } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    if (!targetMember) {
      throw new Error('لم يتم العثور على العضو');
    }

    if (!this.canModerate(moderator, targetMember)) {
      throw new Error('لا يمكنك طرد هذا العضو');
    }

    // ⚡ رقم الكيس بالتوازي مع عملية الطرد
    const caseIdPromise = getNextCaseId(guild.id);

    // Kick the member
    await targetMember.kick(reason);

    const caseId = await caseIdPromise;

    // Create embed
    const embed = moderationEmbed({
      type: 'kick',
      moderator: moderator.user,
      target,
      reason,
      caseId,
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
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
      color: Colors.error,
    });

    void this.logAction(guild, embed);

    logger.info(`Kicked ${target.id} from ${guild.id} by ${moderator.id}`);
    return { case: null, embed };
  }

  // --------------------------------------------
  // Timeout
  // --------------------------------------------
  async timeout(options: ModerationOptions): Promise<{ case: any; embed: any }> {
    const { guild, moderator, target, reason, duration } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    if (!targetMember) {
      throw new Error('لم يتم العثور على العضو');
    }

    if (!this.canModerate(moderator, targetMember)) {
      throw new Error('لا يمكنك كتم هذا العضو');
    }

    // Parse duration
    const durationMs = duration ? parseDuration(duration) : 600000; // Default 10 minutes
    if (!durationMs || durationMs <= 0 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      throw new Error('مدة غير صالحة (الحد الأقصى 28 يوم)');
    }

    // ⚡ رقم الكيس بالتوازي مع عملية الكتم
    const caseIdPromise = getNextCaseId(guild.id);

    // Timeout the member
    await targetMember.timeout(durationMs, reason);

    const caseId = await caseIdPromise;

    // Create embed
    const embed = moderationEmbed({
      type: 'timeout',
      moderator: moderator.user,
      target,
      reason,
      caseId,
      duration: formatDuration(durationMs),
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
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
      description: `تم كتمك في **${guild.name}**\n\n**المدة:** ${formatDuration(durationMs)}\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
      color: Colors.warning,
    });

    void this.logAction(guild, embed);

    logger.info(`Timed out ${target.id} in ${guild.id} by ${moderator.id}`);
    return { case: null, embed };
  }

  // --------------------------------------------
  // Remove Timeout
  // --------------------------------------------
  async removeTimeout(options: ModerationOptions): Promise<{ case: any; embed: any }> {
    const { guild, moderator, target, reason } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    if (!targetMember) {
      throw new Error('لم يتم العثور على العضو');
    }

    if (!this.canModerate(moderator, targetMember)) {
      throw new Error('لا يمكنك إلغاء كتم هذا العضو');
    }

    // ⚡ رقم الكيس بالتوازي مع إلغاء الكتم
    const caseIdPromise = getNextCaseId(guild.id);

    // Remove timeout
    await targetMember.timeout(null, reason);

    const caseId = await caseIdPromise;

    // Create embed
    const embed = moderationEmbed({
      type: 'untimeout',
      moderator: moderator.user,
      target,
      reason,
      caseId,
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
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
      color: Colors.success,
    });

    void this.logAction(guild, embed);

    logger.info(`Removed timeout for ${target.id} in ${guild.id} by ${moderator.id}`);
    return { case: null, embed };
  }

  // --------------------------------------------
  // Warn
  // --------------------------------------------
  async warn(options: ModerationOptions): Promise<{ case: any; embed: any; warningCount: number }> {
    const { guild, moderator, target, reason } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    if (!this.canModerate(moderator, targetMember || (target as User))) {
      throw new Error('لا يمكنك تحذير هذا العضو');
    }

    // ⚡ عدّ التحذيرات + رقم الكيس بالتوازي (استعلامان في وقت واحد بدل متتاليين)
    const [warningCount, caseId] = await Promise.all([
      Warning.countDocuments({ guildId: guild.id, userId: target.id }),
      getNextCaseId(guild.id),
    ]);

    // سجل التحذير (ضروري لعملية unwarn) — يبقى متزامناً
    await Warning.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      reason,
      caseId,
    });

    // Create embed
    const embed = moderationEmbed({
      type: 'warn',
      moderator: moderator.user,
      target,
      reason,
      caseId,
    });

    // ⚡ كل ما لا يؤثر على الرد يعمل في الخلفية
    void ModerationCase.create({
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
      color: Colors.warning,
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
  async unwarn(options: ModerationOptions): Promise<{ case: any; embed: any; warningCount: number }> {
    const { guild, moderator, target, reason } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    // ⚡ العدّ + آخر تحذير + رقم الكيس كلها بالتوازي
    const [warningCount, latest, caseId] = await Promise.all([
      Warning.countDocuments({ guildId: guild.id, userId: target.id }),
      Warning.findOne({ guildId: guild.id, userId: target.id }).sort({ createdAt: -1 }),
      getNextCaseId(guild.id),
    ]);

    if (warningCount === 0) {
      throw new Error('هذا العضو ليس لديه أي تحذيرات');
    }

    // إزالة أحدث تحذير
    if (latest) {
      await Warning.findByIdAndDelete(latest._id);
    }

    const remaining = Math.max(0, warningCount - 1);

    const embed = moderationEmbed({
      type: 'unwarn',
      moderator: moderator.user,
      target,
      reason,
      caseId,
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
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
      color: Colors.success,
    });

    void this.logAction(guild, embed);

    logger.info(`Unwarned ${target.id} in ${guild.id} by ${moderator.id} (remaining: ${remaining})`);
    return { case: null, embed, warningCount: remaining };
  }

  // --------------------------------------------
  // Check Warning Threshold
  // --------------------------------------------
  private async checkWarningThreshold(guild: Guild, userId: string, warningCount: number): Promise<void> {
    // Default thresholds: 5 warnings = kick, 10 warnings = ban
    const kickThreshold = 5;
    const banThreshold = 10;

    try {
      const member = guild.members.cache.get(userId);
      if (!member) return;

      if (warningCount >= banThreshold) {
        await guild.members.ban(userId, {
          reason: `Auto-ban: Reached ${banThreshold} warnings`,
          deleteMessageSeconds: 0,
        });
        logger.info(`Auto-banned ${userId} for reaching ${banThreshold} warnings`);
      } else if (warningCount >= kickThreshold) {
        await member.kick(`Auto-kick: Reached ${kickThreshold} warnings`);
        logger.info(`Auto-kicked ${userId} for reaching ${kickThreshold} warnings`);
      }
    } catch (error) {
      logger.error('Failed to check warning threshold:', error);
    }
  }

  // --------------------------------------------
  // Mute (Role-based)
  // --------------------------------------------
  async mute(options: ModerationOptions): Promise<{ case: any; embed: any; simpleMsg: string }> {
    const { guild, moderator, target, reason, duration } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    if (!targetMember) {
      throw new Error('لم يتم العثور على العضو');
    }

    if (!this.canModerate(moderator, targetMember)) {
      throw new Error('لا يمكنك كتم هذا العضو');
    }

    // ⚡ رقم الكيس بالتوازي مع إضافة رول الكتم
    const caseIdPromise = getNextCaseId(guild.id);

    // Get or create mute role
    let muteRole = await this.getMuteRole(guild);

    // Add mute role
    await targetMember.roles.add(muteRole, reason);

    const caseId = await caseIdPromise;

    // Create embed
    const embed = moderationEmbed({
      type: 'mute',
      moderator: moderator.user,
      target,
      reason,
      caseId,
      duration,
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
      guildId: guild.id,
      caseId,
      type: 'mute',
      moderatorId: moderator.id,
      targetId: target.id,
      reason,
      duration: duration ? parseDuration(duration) || undefined : undefined,
      active: true,
    }).catch(err => logger.warn(`Case create failed: ${err.message}`));

    void this.sendDM(target, {
      title: '🔇 تم كتمك',
      description: `تم كتمك في **${guild.name}**\n\n**السبب:** ${reason}\n\n**المشرف:** ${moderator.user.tag}`,
      color: Colors.warning,
    });

    void this.logAction(guild, embed);

    logger.info(`Muted ${target.id} in ${guild.id} by ${moderator.id}`);
    return { case: null, embed, simpleMsg: `🔇 **${target instanceof GuildMember ? target.user.tag : target.tag}** تم كتمه${duration ? ` لمدة ${duration}` : ''} | ${reason}` };
  }

  // --------------------------------------------
  // Unmute
  // --------------------------------------------
  async unmute(options: ModerationOptions): Promise<{ case: any; embed: any; simpleMsg: string }> {
    const { guild, moderator, target, reason } = options;
    const targetMember = target instanceof GuildMember ? target : guild.members.cache.get(target.id);

    if (!targetMember) {
      throw new Error('لم يتم العثور على العضو');
    }

    if (!this.canModerate(moderator, targetMember)) {
      throw new Error('لا يمكنك إلغاء كتم هذا العضو');
    }

    // ⚡ رقم الكيس بالتوازي مع إزالة رول الكتم
    const caseIdPromise = getNextCaseId(guild.id);

    // Get mute role
    const muteRole = await this.getMuteRole(guild);
    if (!muteRole) {
      throw new Error('لا يوجد رول كتم');
    }

    // Remove mute role
    await targetMember.roles.remove(muteRole, reason);

    const caseId = await caseIdPromise;

    // Create embed
    const embed = moderationEmbed({
      type: 'unmute',
      moderator: moderator.user,
      target,
      reason,
      caseId,
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
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
      color: Colors.success,
    });

    void this.logAction(guild, embed);

    logger.info(`Unmuted ${target.id} in ${guild.id} by ${moderator.id}`);
    return { case: null, embed, simpleMsg: `🔊 **${target instanceof GuildMember ? target.user.tag : target.tag}** تم فك الكتم عنه | ${reason}` };
  }

  // --------------------------------------------
  // Add Role (إضافة رول)
  // --------------------------------------------
  async addRole(options: {
    guild: Guild;
    moderator: GuildMember;
    target: GuildMember;
    reason: string;
    roleId: string;
  }): Promise<{ case: any; embed: any; simpleMsg: string }> {
    const { guild, moderator, target, reason, roleId } = options;
    const role = guild.roles.cache.get(roleId);
    if (!role) throw new Error('الرول غير موجود');

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
    if (guild.members.me!.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('رتبة البوت يجب أن تكون أعلى من الرول المضاف');
    }

    // ⚡ رقم الكيس بالتوازي مع إضافة الرول
    const caseIdPromise = getNextCaseId(guild.id);
    await target.roles.add(role, `${reason} | بواسطة ${moderator.user.tag}`);
    const caseId = await caseIdPromise;

    const embed = moderationEmbed({
      type: 'role_add',
      moderator: moderator.user,
      target,
      reason,
      caseId,
      extraFields: [{ name: 'الرول', value: `${role}`, inline: true }],
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
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
  async addRoles(options: {
    guild: Guild;
    moderator: GuildMember;
    target: GuildMember;
    reason: string;
    roleIds: string[];
  }): Promise<{
    case: any;
    embed: any;
    simpleMsg: string;
    added: string[];
    skipped: string[];
  }> {
    const { guild, moderator, target, reason, roleIds } = options;

    if (!this.canModerate(moderator, target)) {
      throw new Error('لا يمكنك إضافة رول لهذا العضو');
    }
    if (!roleIds.length) {
      throw new Error('لم يتم تحديد أي رول');
    }

    const isOwner = moderator.id === guild.ownerId;
    const toAdd: string[] = [];
    const skipped: string[] = [];

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
      if (guild.members.me!.roles.highest.comparePositionTo(role) <= 0) {
        skipped.push(`${role.name} (أعلى من رتبة البوت)`);
        continue;
      }
      toAdd.push(role.id);
    }

    if (!toAdd.length) {
      if (skipped.length && skipped.every(s => s.includes('مملوك بالفعل'))) {
        throw new Error('العضو يملك هذه الرولات بالفعل');
      }
      throw new Error(
        `لا يمكن إعطاء أي رول:\n${skipped.slice(0, 6).map(s => `• ${s}`).join('\n')}`,
      );
    }

    // ⚡ رقم الكيس بالتوازي مع إضافة الرولات
    const caseIdPromise = getNextCaseId(guild.id);
    await target.roles.add(toAdd, `${reason} | بواسطة ${moderator.user.tag}`);
    const caseId = await caseIdPromise;

    const addedRoles = toAdd.map(id => guild.roles.cache.get(id)).filter(Boolean) as Role[];
    const embed = moderationEmbed({
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
    void ModerationCase.create({
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
  async removeRole(options: {
    guild: Guild;
    moderator: GuildMember;
    target: GuildMember;
    reason: string;
    roleId: string;
  }): Promise<{ case: any; embed: any; simpleMsg: string }> {
    const { guild, moderator, target, reason, roleId } = options;
    const role = guild.roles.cache.get(roleId);
    if (!role) throw new Error('الرول غير موجود');

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
    if (guild.members.me!.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('رتبة البوت يجب أن تكون أعلى من الرول المراد إزالتها');
    }

    // ⚡ رقم الكيس بالتوازي مع إزالة الرول
    const caseIdPromise = getNextCaseId(guild.id);
    await target.roles.remove(role, `${reason} | بواسطة ${moderator.user.tag}`);
    const caseId = await caseIdPromise;

    const embed = moderationEmbed({
      type: 'role_remove',
      moderator: moderator.user,
      target,
      reason,
      caseId,
      extraFields: [{ name: 'الرول', value: `${role}`, inline: true }],
    });

    // ⚡ في الخلفية — لا يؤخر الرد
    void ModerationCase.create({
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
  private async getMuteRole(guild: Guild): Promise<any> {
    // Try to find existing
    let muteRoleData = await MuteRole.findOne({ guildId: guild.id });
    
    if (muteRoleData) {
      const role = guild.roles.cache.get(muteRoleData.roleId);
      if (role) return role;
    }

    // Create new mute role
    const role = await createMuteRole(guild);
    
    // Apply permissions to all channels
    await applyMuteRole(guild, role);

    // Save to database
    muteRoleData = await MuteRole.findOneAndUpdate(
      { guildId: guild.id },
      { roleId: role.id },
      { upsert: true, new: true }
    );

    return role;
  }

  // --------------------------------------------
  // Get Warnings
  // --------------------------------------------
  async getWarnings(guildId: string, userId: string): Promise<any[]> {
    return Warning.find({ guildId, userId }).sort({ createdAt: -1 });
  }

  // --------------------------------------------
  // Remove Warning
  // --------------------------------------------
  async removeWarning(guildId: string, userId: string, warningId?: string): Promise<number> {
    const query: any = { guildId, userId };
    if (warningId) query._id = warningId;

    const result = await Warning.deleteMany(query);
    return result.deletedCount;
  }

  // --------------------------------------------
  // Get Moderation Cases
  // --------------------------------------------
  async getCases(guildId: string, options: {
    userId?: string;
    moderatorId?: string;
    type?: ModerationAction;
    limit?: number;
  } = {}): Promise<any[]> {
    const query: any = { guildId };
    
    if (options.userId) query.targetId = options.userId;
    if (options.moderatorId) query.moderatorId = options.moderatorId;
    if (options.type) query.type = options.type;

    return ModerationCase.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }

  // --------------------------------------------
  // Helper Methods
  // --------------------------------------------
  private canModerate(moderator: GuildMember, target: GuildMember | User): boolean {
    if (!(target instanceof GuildMember)) return true; // Can always moderate users not in guild
    
    if (moderator.id === target.id) return false;
    if (moderator.id === moderator.guild.ownerId) return true;
    if (target.id === target.guild.ownerId) return false;
    
    return moderator.roles.highest.position > target.roles.highest.position;
  }

  private async sendDM(user: User | GuildMember, data: {
    title: string;
    description: string;
    color: ColorResolvable;
  }): Promise<void> {
    try {
      const userObj = user instanceof GuildMember ? user.user : user;
      await userObj.send({
        embeds: [createEmbed(data)],
      });
    } catch (error) {
      // DMs might be closed
      logger.debug(`Failed to send DM to ${user.id}`);
    }
  }

  private async logAction(guild: Guild, embed: any): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      
      if (!settings.logging?.enabled || !settings.logging.channelId) return;

      const logChannel = guild.channels.cache.get(settings.logging.channelId) as TextChannel;
      if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to log moderation action:', error);
    }
  }
}

export default ModerationHandler;