// ============================================
// Liberty City Bot - Invite Tracker Handler
// ============================================
// يتتبع الدعوات، يكشف المشبوهة، يكافئ المدعوين

import {
  Client,
  Guild,
  GuildMember,
  Invite,
  TextChannel,
  Role,
  Events,
} from 'discord.js';
import { getGuildSettings } from '../models';
import { createLogger } from '../utils/helpers';
import { LibertyClient } from '../LibertyClient';

const logger = createLogger('InviteTrackerHandler');

interface InviteData {
  code: string;
  uses: number;
  maxUses: number;
  inviterId: string;
  createdAt: number;
  channelId: string;
}

export class InviteTrackerHandler {
  private client: LibertyClient;
  private inviteCache: Map<string, Map<string, InviteData>> = new Map(); // guildId -> code -> data
  private joinTracker: Map<string, { memberId: string; inviteCode: string; timestamp: number }[]> = new Map();

  constructor(client: LibertyClient) {
    this.client = client;
    this.initializeTracking();
  }

  private initializeTracking(): void {
    // تحميل الدعوات عند بدء التشغيل
    this.client.guilds.cache.forEach(guild => this.cacheGuildInvites(guild));
    
    // مراقبة إنشاء/حذف الدعوات
    this.client.on(Events.InviteCreate, invite => this.onInviteCreate(invite));
    this.client.on(Events.InviteDelete, invite => this.onInviteDelete(invite));
  }

  // --------------------------------------------
  // تخزين دعوات السيرفر
  // --------------------------------------------
  async cacheGuildInvites(guild: Guild): Promise<void> {
    try {
      const invites = await guild.invites.fetch();
      const guildCache = new Map<string, InviteData>();
      
      invites.forEach(invite => {
        guildCache.set(invite.code, {
          code: invite.code,
          uses: invite.uses || 0,
          maxUses: invite.maxUses || 0,
          inviterId: invite.inviter?.id || 'unknown',
          createdAt: invite.createdTimestamp || Date.now(),
          channelId: invite.channel?.id || 'unknown',
        });
      });
      
      this.inviteCache.set(guild.id, guildCache);
      logger.info(`📨 Invite cache loaded for ${guild.name}: ${invites.size} invites`);
    } catch (error: any) {
      logger.warn(`Failed to cache invites for ${guild.name}: ${error.message}`);
    }
  }

  // --------------------------------------------
  // أحداث الدعوات
  // --------------------------------------------
  private onInviteCreate(invite: Invite): void {
    if (!invite.guild) return;
    const guildCache = this.inviteCache.get(invite.guild.id);
    if (guildCache) {
      guildCache.set(invite.code, {
        code: invite.code,
        uses: invite.uses || 0,
        maxUses: invite.maxUses || 0,
        inviterId: invite.inviter?.id || 'unknown',
        createdAt: invite.createdTimestamp || Date.now(),
        channelId: invite.channel?.id || 'unknown',
      });
    }
  }

  private onInviteDelete(invite: Invite): void {
    if (!invite.guild) return;
    const guildCache = this.inviteCache.get(invite.guild.id);
    if (guildCache) {
      guildCache.delete(invite.code);
    }
  }

  // --------------------------------------------
  // عند انضمام عضو — كشف الدعوة المستخدمة
  // --------------------------------------------
  async onMemberJoin(member: GuildMember): Promise<{ inviteCode: string | null; inviterId: string | null; isSuspicious: boolean }> {
    const settings = await getGuildSettings(member.guild.id);
    const cfg = settings.protection?.inviteTracker;
    if (!cfg?.enabled || !cfg.trackJoins) return { inviteCode: null, inviterId: null, isSuspicious: false };

    try {
      // نجلب الدعوات الحالية ونقارنها بالكاش
      const currentInvites = await member.guild.invites.fetch();
      const guildCache = this.inviteCache.get(member.guild.id) || new Map();
      
      let usedInvite: InviteData | null = null;
      
      for (const [code, invite] of currentInvites) {
        const cached = guildCache.get(code);
        const inviteUses = invite.uses || 0;
        if (cached && inviteUses > cached.uses) {
          usedInvite = {
            code,
            uses: inviteUses,
            maxUses: invite.maxUses || 0,
            inviterId: invite.inviter?.id || 'unknown',
            createdAt: invite.createdTimestamp || Date.now(),
            channelId: invite.channel?.id || 'unknown',
          };
          // تحديث الكاش
          guildCache.set(code, usedInvite);
          break;
        }
      }

      // إذا لم نجد بالكاش (دعوة جديدة أو أول مرة) — نأخذ أول دعوة صالحة
      if (!usedInvite) {
        for (const [code, invite] of currentInvites) {
          const inviteUses = invite.uses || 0;
          if (!guildCache.has(code) && inviteUses > 0) {
            usedInvite = {
              code,
              uses: inviteUses,
              maxUses: invite.maxUses || 0,
              inviterId: invite.inviter?.id || 'unknown',
              createdAt: invite.createdTimestamp || Date.now(),
              channelId: invite.channel?.id || 'unknown',
            };
            guildCache.set(code, usedInvite);
            break;
          }
        }
      }

      this.inviteCache.set(member.guild.id, guildCache);

      if (!usedInvite) {
        logger.warn(`No invite tracked for ${member.user.tag} in ${member.guild.name}`);
        return { inviteCode: null, inviterId: null, isSuspicious: false };
      }

      // تسجيل الانضمام
      this.recordJoin(member.guild.id, member.id, usedInvite.code);

      // فحص مشبوه
      const isSuspicious = await this.checkSuspiciousInvite(member, usedInvite, cfg);

      return {
        inviteCode: usedInvite.code,
        inviterId: usedInvite.inviterId,
        isSuspicious,
      };
    } catch (error: any) {
      logger.error(`InviteTracker onMemberJoin error (${member.guild.name}): ${error.message}`);
      return { inviteCode: null, inviterId: null, isSuspicious: false };
    }
  }

  private recordJoin(guildId: string, memberId: string, inviteCode: string): void {
    const joins = this.joinTracker.get(guildId) || [];
    joins.push({ memberId, inviteCode, timestamp: Date.now() });
    // نحتفظ بآخر 1000 انضمام فقط
    if (joins.length > 1000) joins.shift();
    this.joinTracker.set(guildId, joins);
  }

  // --------------------------------------------
  // فحص الدعوة المشبوهة
  // --------------------------------------------
  private async checkSuspiciousInvite(member: GuildMember, invite: InviteData, cfg: any): Promise<boolean> {
    // 1️⃣ دعوة حديثة جداً (أقل من minInviteAgeHours)
    const inviteAgeHours = (Date.now() - invite.createdAt) / (1000 * 60 * 60);
    if (inviteAgeHours < cfg.minInviteAgeHours) {
      await this.handleSuspicious(member, invite, `دعوة حديثة (${inviteAgeHours.toFixed(1)} ساعة)`, cfg);
      return true;
    }

    // 2️⃣ دعوة وصلت للحد الأقصى للاستخدامات
    const inviteUses = invite.uses || 0;
    if (cfg.maxUsesPerInvite && invite.maxUses > 0 && inviteUses >= cfg.maxUsesPerInvite) {
      await this.handleSuspicious(member, invite, `دعوة وصلت للحد الأقصى (${inviteUses}/${invite.maxUses})`, cfg);
      return true;
    }

    // 3️⃣ دعوة من سيرفر مشبوه (محتاج API خارجي — نكتفي بالتسجيل)
    // يمكن ربطه بقاعدة بيانات سيرفرات الهكر المعروفة

    return false;
  }

  private async handleSuspicious(member: GuildMember, invite: any, reason: string, cfg: any): Promise<void> {
    const guild = member.guild;
    const client = member.client as any;
    
    try {
      switch (cfg.suspiciousInviteAction) {
        case 'ban':
          await member.ban({ reason: `Invite Tracker: ${reason}`, deleteMessageSeconds: 0 });
          break;
        case 'kick':
          await member.kick(`Invite Tracker: ${reason}`);
          break;
        case 'warn':
          await client.moderationHandler?.warn({ guild, moderator: guild.members.me!, target: member, reason });
          break;
        case 'delete':
        default:
          // تسجيل فقط
          break;
      }

      // لاوج
      if (cfg.logChannel) {
        const logChannel = guild.channels.cache.get(cfg.logChannel) as TextChannel;
        if (logChannel) {
          await logChannel.send({
            content: `📨 **Invite Tracker — دعوة مشبوهة**\n` +
              `👤 **العضو:** ${member.user.tag} (\`${member.id}\`)\n` +
              `⚠️ **السبب:** ${reason}\n` +
              `🔗 **كود الدعوة:** \`${invite.code}\`\n` +
              `👑 **الداعي:** <@${invite.inviterId}>`,
          }).catch(() => {});
        }
      }

      logger.warn(`Suspicious invite in ${guild.name}: ${member.user.tag} — ${reason}`);
    } catch (error: any) {
      logger.error(`InviteTracker handleSuspicious error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // عند مغادرة عضو — تحديث إحصائيات الداعي
  // --------------------------------------------
  async onMemberLeave(member: GuildMember): Promise<void> {
    const settings = await getGuildSettings(member.guild.id);
    const cfg = settings.protection?.inviteTracker;
    if (!cfg?.enabled || !cfg.trackLeaves) return;

    // البحث عن الدعوة اللي استخدمها العضو
    const joins = this.joinTracker.get(member.guild.id) || [];
    const joinRecord = [...joins].reverse().find(j => j.memberId === member.id);
    
    if (joinRecord && cfg.rewardRoleId && cfg.rewardInvites) {
      // نحدث إحصائيات الداعي (محتاج تخزين دائم — يمكن إضافته لاحقاً)
      // حالياً: مجرد تسجيل
      logger.info(`Member left (was invited by ${joinRecord.inviteCode}): ${member.user.tag}`);
    }
  }

  // --------------------------------------------
  // إحصائيات عامة — للأمر /invites
  // --------------------------------------------
  async getInviteStats(guild: Guild, userId: string): Promise<{
    totalInvites: number;
    regularInvites: number;
    leftInvites: number;
    fakeInvites: number;
    rank: number;
  }> {
    // يمكن تخزين الإحصائيات في قاعدة البيانات
    // حالياً: نرجع بيانات من الكاش
    return {
      totalInvites: 0,
      regularInvites: 0,
      leftInvites: 0,
      fakeInvites: 0,
      rank: 0,
    };
  }

  // --------------------------------------------
  // مكافأة الداعين — عند الوصول لعدد معين
  // --------------------------------------------
  async checkAndGiveReward(guild: Guild, inviterId: string, totalInvites: number): Promise<void> {
    const settings = await getGuildSettings(guild.id);
    const cfg = settings.protection?.inviteTracker;
    if (!cfg?.enabled || !cfg.rewardRoleId || !cfg.rewardInvites) return;

    if (totalInvites >= cfg.rewardInvites) {
      const inviter = await guild.members.fetch(inviterId).catch(() => null);
      const role = guild.roles.cache.get(cfg.rewardRoleId);
      
      if (inviter && role && !inviter.roles.cache.has(role.id)) {
        try {
          await inviter.roles.add(role, `Invite Reward: ${totalInvites} دعوات`);
          
          if (cfg.logChannel) {
            const logChannel = guild.channels.cache.get(cfg.logChannel) as TextChannel;
            if (logChannel) {
              await logChannel.send({
                content: `🎁 **مكافأة دعوات**\n` +
                  `👤 **${inviter.user.tag}** وصل لـ **${totalInvites}** دعوة!\n` +
                  `🎭 **تم إعطاؤه رول:** ${role}`,
              }).catch(() => {});
            }
          }
        } catch (error: any) {
          logger.error(`Invite reward error: ${error.message}`);
        }
      }
    }
  }

  // --------------------------------------------
  // تحديث الكاش يدوياً
  // --------------------------------------------
  async refreshCache(guild: Guild): Promise<void> {
    await this.cacheGuildInvites(guild);
  }
}

export default InviteTrackerHandler;