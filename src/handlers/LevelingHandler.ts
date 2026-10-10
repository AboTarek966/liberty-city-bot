// ============================================
// Liberty City Bot - Leveling Handler
// نظام المستويات المركزي: XP، الترقيات، مكافآت الرولات، بطاقة الرank
// ============================================

import {
  Client,
  Guild,
  GuildMember,
  TextChannel,
  ChannelType,
  EmbedBuilder,
  ColorResolvable,
} from 'discord.js';
import { createLogger, calculateLevel, calculateXpForLevel, getXpProgress } from '../utils/helpers';
import { getGuildSettings, UserProfile, IUserProfile } from '../models';
import { createEmbed, Colors } from '../utils/embeds';

const logger = createLogger('LevelingHandler');

// --------------------------------------------
// Types
// --------------------------------------------
export interface LevelUpResult {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  profile: IUserProfile;
}

export interface RankCardData {
  member: GuildMember;
  profile: IUserProfile;
  rank: number;
  totalMembers: number;
  progress: { current: number; next: number; progress: number };
}

const BAR_LENGTH = 12;

function progressBar(percent: number): string {
  const filled = Math.max(0, Math.min(BAR_LENGTH, Math.round((percent / 100) * BAR_LENGTH)));
  return '█'.repeat(filled) + '░'.repeat(BAR_LENGTH - filled);
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} دقيقة`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours < 24) return `${hours} س ${mins} د`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days} ي ${remHours} س`;
}

// --------------------------------------------
// Leveling Handler
// --------------------------------------------
export class LevelingHandler {
  private client: Client;
  // كولداون XP الرسائل: key = `${guildId}:${userId}` → آخر وقت
  private xpCooldowns = new Map<string, number>();
  // جلسات الصوت: key = `${guildId}:${userId}` → وقت الدخول
  private voiceJoins = new Map<string, number>();

  constructor(client: Client) {
    this.client = client;
  }

  // ==========================================
  // الحسابات
  // ==========================================
  calculateLevel(xp: number): number {
    return calculateLevel(xp);
  }

  xpForLevel(level: number): number {
    return calculateXpForLevel(level);
  }

  getXpProgress(xp: number) {
    return getXpProgress(xp);
  }

  // ==========================================
  // الملف الشخصي
  // ==========================================
  async getOrCreateProfile(userId: string, guildId: string): Promise<IUserProfile> {
    let profile = await UserProfile.findOne({ userId, guildId });
    if (!profile) {
      profile = await UserProfile.create({ userId, guildId });
    }
    return profile;
  }

  // ==========================================
  // إضافة XP رسالة
  // ==========================================
  async addMessageXp(member: GuildMember, channelId: string): Promise<LevelUpResult | null> {
    const guild = member.guild;
    const settings = await getGuildSettings(guild.id);
    const lv = settings.leveling;

    if (!lv?.enabled) return null;
    if (member.user.bot) return null;
    if (lv.ignoredChannels?.includes(channelId)) return null;
    if (lv.ignoredRoles?.some((r: string) => member.roles.cache.has(r))) return null;

    const key = `${guild.id}:${member.id}`;
    const now = Date.now();
    const last = this.xpCooldowns.get(key);
    if (last && now - last < (lv.xpCooldown || 60000)) return null;
    this.xpCooldowns.set(key, now);

    const profile = await this.getOrCreateProfile(member.id, guild.id);
    const oldLevel = profile.level;
    const gain = Math.max(1, Math.floor((lv.xpPerMessage || 15) * (lv.xpGainMultiplier || 1)));

    profile.xp += gain;
    profile.totalXp += gain;
    profile.messagesSent += 1;
    profile.level = calculateLevel(profile.xp);
    await profile.save();

    const leveledUp = profile.level > oldLevel;
    if (leveledUp) {
      await this.handleLevelUp(member, oldLevel, profile.level, channelId);
    }

    return { leveledUp, oldLevel, newLevel: profile.level, profile };
  }

  // ==========================================
  // إضافة XP صوت (يُستدعى عند مغادرة قناة صوتية)
  // ==========================================
  async trackVoiceJoin(guildId: string, userId: string): Promise<void> {
    this.voiceJoins.set(`${guildId}:${userId}`, Date.now());
  }

  async addVoiceXp(guildId: string, userId: string): Promise<LevelUpResult | null> {
    const key = `${guildId}:${userId}`;
    const joinedAt = this.voiceJoins.get(key);
    if (!joinedAt) return null;
    this.voiceJoins.delete(key);

    const minutes = Math.max(1, Math.round((Date.now() - joinedAt) / 60000));
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;

    const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
    if (!member || member.user.bot) return null;

    const settings = await getGuildSettings(guildId);
    const lv = settings.leveling;
    if (!lv?.enabled) return null;
    if (lv.ignoredRoles?.some((r: string) => member.roles.cache.has(r))) return null;

    const profile = await this.getOrCreateProfile(userId, guildId);
    const oldLevel = profile.level;
    const gain = Math.max(
      1,
      Math.floor(minutes * (lv.voiceXpPerMinute || 10) * (lv.xpGainMultiplier || 1))
    );

    profile.xp += gain;
    profile.totalXp += gain;
    profile.voiceTime += minutes;
    profile.level = calculateLevel(profile.xp);
    await profile.save();

    const leveledUp = profile.level > oldLevel;
    if (leveledUp) {
      await this.handleLevelUp(member, oldLevel, profile.level);
    }

    return { leveledUp, oldLevel, newLevel: profile.level, profile };
  }

  // يمنح XP لأي جلسات صوتية ما زالت جارية (ندعوها دوريًا من ready)
  async creditActiveVoiceSessions(): Promise<void> {
    for (const key of this.voiceJoins.keys()) {
      const [guildId, userId] = key.split(':');
      const joinedAt = this.voiceJoins.get(key)!;
      const minutes = Math.floor((Date.now() - joinedAt) / 60000);
      if (minutes >= 1) {
        await this.addVoiceXp(guildId, userId).catch(() => {});
        // إعادة ضبط الوقت لتفادي العد المزدوج
        this.voiceJoins.set(key, Date.now());
      }
    }
  }

  // ==========================================
  // الترقية (رسالة + مكافآت)
  // ==========================================
  async handleLevelUp(
    member: GuildMember,
    oldLevel: number,
    newLevel: number,
    fallbackChannelId?: string
  ): Promise<void> {
    await this.sendLevelUpMessage(member, newLevel, fallbackChannelId).catch(err =>
      logger.warn('Failed to send level-up message:', err)
    );

    const awarded = await this.assignLevelRewards(member, newLevel);
    logger.info(
      `${member.user.tag} leveled up ${oldLevel} → ${newLevel}${awarded.length ? ` (awarded: ${awarded.join(', ')})` : ''}`
    );
  }

  // -----------------------------------------
  // رسالة الترقية (نص أو إمبد) + استبدال المتغيرات
  // -----------------------------------------
  private buildVars(member: GuildMember, level: number, profile: IUserProfile, rank: number): Record<string, string> {
    return {
      user: `<@${member.id}>`,
      username: member.user.username,
      level: level.toString(),
      xp: profile.xp.toString(),
      totalXp: profile.totalXp.toString(),
      server: member.guild.name,
      rank: rank.toString(),
    };
  }

  private applyVars(text: string, vars: Record<string, string>): string {
    return text.replace(/\{(user|username|level|xp|totalXp|server|rank)\}/g, (_, k) => vars[k] ?? '');
  }

  async sendLevelUpMessage(
    member: GuildMember,
    level: number,
    fallbackChannelId?: string
  ): Promise<void> {
    const guild = member.guild;
    const settings = await getGuildSettings(guild.id);
    const lv = settings.leveling;
    const profile = await this.getOrCreateProfile(member.id, guild.id);
    const rank = await this.getRank(member.id, guild.id);
    const vars = this.buildVars(member, level, profile, rank);

    // تحديد قناة الإرسال
    let channel: TextChannel | null = null;
    if (lv.levelUpChannelId) {
      const c = guild.channels.cache.get(lv.levelUpChannelId);
      if (c && c.type === ChannelType.GuildText) channel = c as TextChannel;
    }
    if (!channel && fallbackChannelId) {
      const c = guild.channels.cache.get(fallbackChannelId);
      if (c && c.type === ChannelType.GuildText) channel = c as TextChannel;
    }
    if (!channel) return;

    if (lv.levelUpStyle === 'text') {
      const text = this.applyVars(
        lv.levelUpMessage || '🎉 مبروك {user}! وصلت للمستوى **{level}**',
        vars
      );
      const msg = await channel.send({ content: text }).catch(() => null);
      if (msg && !lv.levelUpChannelId) {
        setTimeout(() => msg.delete().catch(() => {}), 12000);
      }
      return;
    }

    // نمط إمبد احترافي (الافتراضي)
    const color = this.parseColor(lv.levelUpColor) || (Colors.warning as ColorResolvable);
    const title = this.applyVars(lv.levelUpTitle || '🎉 ترقية جديدة!', vars);
    const description = this.applyVars(
      lv.levelUpMessage || 'تهانينا {user}! لقد وصلت للمستوى {level} 🎉',
      vars
    );

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setThumbnail(member.user.displayAvatarURL({ size: 128, extension: 'png' }))
      .addFields(
        { name: '📈 المستوى', value: `\`${level}\``, inline: true },
        { name: '✨ الخبرة', value: `\`${profile.xp}\` XP`, inline: true },
        { name: '🏆 الترتيب', value: `\`#${rank}\``, inline: true }
      )
      .setFooter({ text: `${member.guild.name} • نظام المستويات` })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  }

  private parseColor(hex?: string): ColorResolvable | null {
    if (!hex) return null;
    const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (!m) return null;
    return parseInt(m[1], 16) as ColorResolvable;
  }

  // -----------------------------------------
  // مكافآت الرولات (تراكمية — كل المستويات المُبلَغ عنها فما فوق)
  // يدعم الرسائل القديمة (levelRoles map) والجديدة (levelRewards array)
  // -----------------------------------------
  async assignLevelRewards(member: GuildMember, level: number): Promise<string[]> {
    const guild = member.guild;
    const settings = await getGuildSettings(guild.id);
    const lv = settings.leveling;
    const awarded: string[] = [];

    // دمج المكافآت: الجديدة (array) + القديمة (map)
    const rewards: Array<{ level: number; roleId: string }> = [];

    if (Array.isArray(lv.levelRewards)) {
      for (const r of lv.levelRewards) {
        if (r && typeof r.level === 'number' && r.roleId) {
          rewards.push({ level: r.level, roleId: r.roleId });
        }
      }
    }

    if (lv.levelRoles && typeof lv.levelRoles.forEach === 'function') {
      lv.levelRoles.forEach((roleId: string, lvl: any) => {
        const n = Number(lvl);
        if (!Number.isNaN(n) && roleId) rewards.push({ level: n, roleId });
      });
    }

    // المستويات التي بلغها العضو فما فوق (تراكمي)
    const eligible = rewards.filter(r => r.level <= level && r.roleId);
    // تفريد حسب roleId مع الأعلى مستوى أولًا
    const byRole = new Map<string, number>();
    for (const r of eligible) {
      const cur = byRole.get(r.roleId);
      if (cur === undefined || r.level > cur) byRole.set(r.roleId, r.level);
    }

    for (const [roleId] of byRole) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;
      if (member.roles.cache.has(roleId)) continue;
      // لا نمنح رولًا أعلى من رتبة البوت
      if (role.position >= (guild.members.me?.roles.highest.position ?? 0)) continue;

      const ok = await member.roles.add(role, `Level Up → ${level}`).catch(() => null);
      if (ok) awarded.push(role.name);
    }

    return awarded;
  }

  // ==========================================
  // الترتيب (Rank)
  // ==========================================
  async getRank(userId: string, guildId: string): Promise<number> {
    const profile = await UserProfile.findOne({ userId, guildId });
    if (!profile) return 1;
    // عدد الأعضاء בעלי XP أعلى (الترتيب يعتمد على إجمالي الخبرة)
    const higher = await UserProfile.countDocuments({
      guildId,
      xp: { $gt: profile.xp },
    });
    return higher + 1;
  }

  async getMemberCount(guildId: string): Promise<number> {
    return UserProfile.countDocuments({ guildId });
  }

  // ==========================================
  // بطاقة الرank (امبد تفاعلي جميل)
  // ==========================================
  async buildRankCard(member: GuildMember): Promise<EmbedBuilder> {
    const profile = await this.getOrCreateProfile(member.id, member.guild.id);
    const rank = await this.getRank(member.id, member.guild.id);
    const totalMembers = await this.getMemberCount(member.guild.id);
    const progress = getXpProgress(profile.xp);
    const nextLevelXp = calculateXpForLevel(profile.level + 1);

    const medals = ['🥇', '🥈', '🥉'];
    const rankLabel = medals[rank - 1] || `#${rank}`;

    const bar = progressBar(progress.progress);

    const embed = new EmbedBuilder()
      .setColor(Colors.primary as ColorResolvable)
      .setAuthor({
        name: `${member.user.username} • ${rankLabel}`,
        iconURL: member.user.displayAvatarURL({ size: 128, extension: 'png' }),
      })
      .setThumbnail(member.user.displayAvatarURL({ size: 256, extension: 'png' }))
      .setDescription(
        `> 🏆 **الترتيب:** \`${rank}\` من \`${totalMembers}\` عضو\n` +
          `> 📈 **المستوى:** \`${profile.level}\`\n\n` +
          `**الخبرة:** \`${progress.current}\` / \`${progress.next}\` XP  (الإجمالي: \`${profile.xp}\`)\n` +
          `\`${bar}\` **${Math.floor(progress.progress)}%**\n\n` +
          `> 💬 **الرسائل:** \`${profile.messagesSent.toLocaleString('en-US')}\`\n` +
          `> 🔊 **الصوت:** \`${formatMinutes(profile.voiceTime)}\``
      )
      .setFooter({ text: `${member.guild.name} • المستوى التالي عند ${nextLevelXp} XP` })
      .setTimestamp();

    return embed;
  }

  // ==========================================
  // توب الأعضاء (لأغراض لوحة المتصدرين بالمستويات)
  // ==========================================
  async getTopMembers(guildId: string, limit: number = 10) {
    return UserProfile.find({ guildId })
      .sort({ xp: -1 })
      .limit(limit)
      .lean();
  }

  // ==========================================
  // تفريغ كولداون (تنظيف)
  // ==========================================
  cleanup(): void {
    this.xpCooldowns.clear();
    this.voiceJoins.clear();
  }
}

export default LevelingHandler;
