// ============================================
// Liberty City Bot - Activity Tracker
// Daily / Weekly / Monthly / Total stats for
// text messages and voice time
// ============================================

import { Client, GuildMember, VoiceState } from 'discord.js';
import mongoose, { Document, Schema } from 'mongoose';
import { createLogger } from '../utils/helpers';

const logger = createLogger('ActivityTracker');

// --------------------------------------------
// Model
// --------------------------------------------
export interface IActivityStats extends Document {
  guildId: string;
  userId: string;
  period: 'day' | 'week' | 'month' | 'total';
  date: string; // YYYY-MM-DD for day, ISO week for week, YYYY-MM for month, 'all' for total
  messages: number;
  voiceMinutes: number;
  voiceJoins: number;
  updatedAt: Date;
}

const ActivityStatsSchema = new Schema<IActivityStats>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  period: { type: String, enum: ['day', 'week', 'month', 'total'], required: true },
  date: { type: String, required: true },
  messages: { type: Number, default: 0 },
  voiceMinutes: { type: Number, default: 0 },
  voiceJoins: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

ActivityStatsSchema.index({ guildId: 1, userId: 1, period: 1, date: 1 }, { unique: true });

const ActivityStats = mongoose.model<IActivityStats>('ActivityStats', ActivityStatsSchema);

// --------------------------------------------
// Date Helpers
// --------------------------------------------
function getDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekKey(d: Date = new Date()): string {
  // ISO week: year-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// --------------------------------------------
// Activity Tracker Class
// --------------------------------------------
export class ActivityTracker {
  private client: Client;
  // voice join timestamps: key = `${guildId}:${userId}` -> join time
  private voiceJoins: Map<string, number> = new Map();
  // periodic flush timer
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;

    // Flush stats every 30 seconds (voice time + batched message counts)
    this.flushTimer = setInterval(() => {
      this.flushVoiceTime().catch(err => logger.error('Flush voice time error:', err));
      this.flushMessages().catch(err => logger.error('Flush message stats error:', err));
    }, 30_000);

    // Listen for voice state changes
    client.on('voiceStateUpdate', (oldState, newState) => {
      this.handleVoiceState(oldState, newState).catch(err =>
        logger.error('Voice state tracking error:', err)
      );
    });
  }

  // --------------------------------------------
  // Track a message (📦 عدّاد في الذاكرة — يُكتب دفعة واحدة كل 30 ثانية)
  // كان يُنفّذ 4 عمليات كتابة في قاعدة البيانات لكل رسالة!
  // --------------------------------------------
  private pendingMessages = new Map<string, number>();

  async trackMessage(guildId: string, userId: string): Promise<void> {
    try {
      const now = new Date();
      const keys = [
        ['day', getDayKey(now)],
        ['week', getWeekKey(now)],
        ['month', getMonthKey(now)],
        ['total', 'all'],
      ] as const;

      for (const [period, date] of keys) {
        const k = `${guildId}:${userId}:${period}:${date}`;
        this.pendingMessages.set(k, (this.pendingMessages.get(k) || 0) + 1);
      }
    } catch (error) {
      logger.error('Error tracking message:', error);
    }
  }

  // كتابة العدّادات المجمّعة إلى قاعدة البيانات (دفعة واحدة)
  private async flushMessages(): Promise<void> {
    if (this.pendingMessages.size === 0) return;
    const entries = [...this.pendingMessages.entries()];
    this.pendingMessages.clear();

    try {
      const ops = entries.map(([key, count]) => {
        const [guildId, userId, period, date] = key.split(':');
        return {
          updateOne: {
            filter: { guildId, userId, period, date },
            update: { $inc: { messages: count }, $set: { updatedAt: new Date() } },
            upsert: true,
          },
        };
      });
      await ActivityStats.bulkWrite(ops, { ordered: false });
    } catch (error) {
      logger.error('Error flushing message stats:', error);
      // إعادة العدّادات المفقودة حتى لا تضيع
      for (const [key, count] of entries) {
        this.pendingMessages.set(key, (this.pendingMessages.get(key) || 0) + count);
      }
    }
  }

  // --------------------------------------------
  // Voice State Handling
  // --------------------------------------------
  private async handleVoiceState(oldState: any, newState: any): Promise<void> {
    const guild = newState.guild;
    if (!guild) return;

    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    const key = `${guild.id}:${member.id}`;

    // Joined a voice channel (from nothing)
    if (!oldState.channelId && newState.channelId) {
      this.voiceJoins.set(key, Date.now());
      await this.addVoiceJoin(guild.id, member.id);
      return;
    }

    // Left all voice channels
    if (oldState.channelId && !newState.channelId) {
      const joinedAt = this.voiceJoins.get(key);
      if (joinedAt) {
        const minutes = Math.max(1, Math.round((Date.now() - joinedAt) / 60000));
        this.voiceJoins.delete(key);
        await this.addVoiceTime(guild.id, member.id, minutes);
      }
      return;
    }

    // Moved between channels - keep the original join time (continuous session)
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      if (!this.voiceJoins.has(key)) {
        this.voiceJoins.set(key, Date.now());
      }
    }
  }

  private async addVoiceJoin(guildId: string, userId: string): Promise<void> {
    const now = new Date();
    const keys = [
      ['day', getDayKey(now)],
      ['week', getWeekKey(now)],
      ['month', getMonthKey(now)],
      ['total', 'all'],
    ] as const;

    await Promise.all(
      keys.map(([period, date]) =>
        ActivityStats.updateOne(
          { guildId, userId, period, date },
          { $inc: { voiceJoins: 1 }, $set: { updatedAt: new Date() } },
          { upsert: true }
        ).exec()
      )
    );
  }

  private async addVoiceTime(guildId: string, userId: string, minutes: number): Promise<void> {
    const now = new Date();
    const keys = [
      ['day', getDayKey(now)],
      ['week', getWeekKey(now)],
      ['month', getMonthKey(now)],
      ['total', 'all'],
    ] as const;

    await Promise.all(
      keys.map(([period, date]) =>
        ActivityStats.updateOne(
          { guildId, userId, period, date },
          { $inc: { voiceMinutes: minutes }, $set: { updatedAt: new Date() } },
          { upsert: true }
        ).exec()
      )
    );

    logger.debug(`Voice time: +${minutes}m for ${userId} in ${guildId}`);
  }

  // Flush all active voice sessions (called periodically)
  private async flushVoiceTime(): Promise<void> {
    // Nothing to flush mid-session; time is credited on leave.
    // But if bot restarts, stale joins lose time — handle on ready by crediting elapsed.
  }

  // Credit elapsed voice time for all current sessions (call on ready after restart)
  async creditActiveSessions(): Promise<void> {
    const now = Date.now();
    for (const [key, joinedAt] of this.voiceJoins.entries()) {
      const [guildId, userId] = key.split(':');
      const minutes = Math.floor((now - joinedAt) / 60000);
      if (minutes >= 1) {
        await this.addVoiceTime(guildId, userId, minutes);
      }
      // Reset the join time to now to avoid double counting
      this.voiceJoins.set(key, now);
    }
  }

  // --------------------------------------------
  // Get Stats
  // --------------------------------------------
  async getStats(
    guildId: string,
    userId: string,
    period: 'day' | 'week' | 'month' | 'total'
  ): Promise<{ messages: number; voiceMinutes: number; voiceJoins: number }> {
    let date: string;
    const now = new Date();
    switch (period) {
      case 'day': date = getDayKey(now); break;
      case 'week': date = getWeekKey(now); break;
      case 'month': date = getMonthKey(now); break;
      default: date = 'all';
    }

    const stats = await ActivityStats.findOne({ guildId, userId, period, date });
    return {
      messages: stats?.messages || 0,
      voiceMinutes: stats?.voiceMinutes || 0,
      voiceJoins: stats?.voiceJoins || 0,
    };
  }

  async getStatsAllPeriods(guildId: string, userId: string) {
    const [day, week, month, total] = await Promise.all([
      this.getStats(guildId, userId, 'day'),
      this.getStats(guildId, userId, 'week'),
      this.getStats(guildId, userId, 'month'),
      this.getStats(guildId, userId, 'total'),
    ]);
    return { day, week, month, total };
  }

  // Leaderboard
  async getLeaderboard(
    guildId: string,
    period: 'day' | 'week' | 'month' | 'total',
    type: 'messages' | 'voiceMinutes',
    limit: number = 10
  ) {
    let date: string;
    const now = new Date();
    switch (period) {
      case 'day': date = getDayKey(now); break;
      case 'week': date = getWeekKey(now); break;
      case 'month': date = getMonthKey(now); break;
      default: date = 'all';
    }

    return ActivityStats.find({ guildId, period, date })
      .sort({ [type]: -1 })
      .limit(limit)
      .lean();
  }

  // --------------------------------------------
  // Cleanup
  // --------------------------------------------
  cleanup(): void {
    // كتابة العدّادات المجمّعة قبل الإيقاف (حتى لا تضيع)
    this.flushMessages().catch(() => {});
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.voiceJoins.clear();
  }
}

export default ActivityTracker;
export { ActivityStats, getDayKey, getWeekKey, getMonthKey };
