"use strict";
// ============================================
// Liberty City Bot - Activity Tracker
// Daily / Weekly / Monthly / Total stats for
// text messages and voice time
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityStats = exports.ActivityTracker = void 0;
exports.getDayKey = getDayKey;
exports.getWeekKey = getWeekKey;
exports.getMonthKey = getMonthKey;
const mongoose_1 = __importStar(require("mongoose"));
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('ActivityTracker');
const ActivityStatsSchema = new mongoose_1.Schema({
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
const ActivityStats = mongoose_1.default.model('ActivityStats', ActivityStatsSchema);
exports.ActivityStats = ActivityStats;
// --------------------------------------------
// Date Helpers
// --------------------------------------------
function getDayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getMonthKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getWeekKey(d = new Date()) {
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
class ActivityTracker {
    client;
    // voice join timestamps: key = `${guildId}:${userId}` -> join time
    voiceJoins = new Map();
    // periodic flush timer
    flushTimer = null;
    constructor(client) {
        this.client = client;
        // Flush stats every 30 seconds (voice time + batched message counts)
        this.flushTimer = setInterval(() => {
            this.flushVoiceTime().catch(err => logger.error('Flush voice time error:', err));
            this.flushMessages().catch(err => logger.error('Flush message stats error:', err));
        }, 30_000);
        // Listen for voice state changes
        client.on('voiceStateUpdate', (oldState, newState) => {
            this.handleVoiceState(oldState, newState).catch(err => logger.error('Voice state tracking error:', err));
        });
    }
    // --------------------------------------------
    // Track a message (📦 عدّاد في الذاكرة — يُكتب دفعة واحدة كل 30 ثانية)
    // كان يُنفّذ 4 عمليات كتابة في قاعدة البيانات لكل رسالة!
    // --------------------------------------------
    pendingMessages = new Map();
    async trackMessage(guildId, userId) {
        try {
            const now = new Date();
            const keys = [
                ['day', getDayKey(now)],
                ['week', getWeekKey(now)],
                ['month', getMonthKey(now)],
                ['total', 'all'],
            ];
            for (const [period, date] of keys) {
                const k = `${guildId}:${userId}:${period}:${date}`;
                this.pendingMessages.set(k, (this.pendingMessages.get(k) || 0) + 1);
            }
        }
        catch (error) {
            logger.error('Error tracking message:', error);
        }
    }
    // كتابة العدّادات المجمّعة إلى قاعدة البيانات (دفعة واحدة)
    async flushMessages() {
        if (this.pendingMessages.size === 0)
            return;
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
        }
        catch (error) {
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
    async handleVoiceState(oldState, newState) {
        const guild = newState.guild;
        if (!guild)
            return;
        const member = newState.member || oldState.member;
        if (!member || member.user?.bot)
            return;
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
    async addVoiceJoin(guildId, userId) {
        const now = new Date();
        const keys = [
            ['day', getDayKey(now)],
            ['week', getWeekKey(now)],
            ['month', getMonthKey(now)],
            ['total', 'all'],
        ];
        await Promise.all(keys.map(([period, date]) => ActivityStats.updateOne({ guildId, userId, period, date }, { $inc: { voiceJoins: 1 }, $set: { updatedAt: new Date() } }, { upsert: true }).exec()));
    }
    async addVoiceTime(guildId, userId, minutes) {
        const now = new Date();
        const keys = [
            ['day', getDayKey(now)],
            ['week', getWeekKey(now)],
            ['month', getMonthKey(now)],
            ['total', 'all'],
        ];
        await Promise.all(keys.map(([period, date]) => ActivityStats.updateOne({ guildId, userId, period, date }, { $inc: { voiceMinutes: minutes }, $set: { updatedAt: new Date() } }, { upsert: true }).exec()));
        logger.debug(`Voice time: +${minutes}m for ${userId} in ${guildId}`);
    }
    // Flush all active voice sessions (called periodically)
    async flushVoiceTime() {
        // Nothing to flush mid-session; time is credited on leave.
        // But if bot restarts, stale joins lose time — handle on ready by crediting elapsed.
    }
    // Credit elapsed voice time for all current sessions (call on ready after restart)
    async creditActiveSessions() {
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
    async getStats(guildId, userId, period) {
        let date;
        const now = new Date();
        switch (period) {
            case 'day':
                date = getDayKey(now);
                break;
            case 'week':
                date = getWeekKey(now);
                break;
            case 'month':
                date = getMonthKey(now);
                break;
            default: date = 'all';
        }
        const stats = await ActivityStats.findOne({ guildId, userId, period, date });
        return {
            messages: stats?.messages || 0,
            voiceMinutes: stats?.voiceMinutes || 0,
            voiceJoins: stats?.voiceJoins || 0,
        };
    }
    async getStatsAllPeriods(guildId, userId) {
        const [day, week, month, total] = await Promise.all([
            this.getStats(guildId, userId, 'day'),
            this.getStats(guildId, userId, 'week'),
            this.getStats(guildId, userId, 'month'),
            this.getStats(guildId, userId, 'total'),
        ]);
        return { day, week, month, total };
    }
    // Leaderboard
    async getLeaderboard(guildId, period, type, limit = 10) {
        let date;
        const now = new Date();
        switch (period) {
            case 'day':
                date = getDayKey(now);
                break;
            case 'week':
                date = getWeekKey(now);
                break;
            case 'month':
                date = getMonthKey(now);
                break;
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
    cleanup() {
        // كتابة العدّادات المجمّعة قبل الإيقاف (حتى لا تضيع)
        this.flushMessages().catch(() => { });
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this.voiceJoins.clear();
    }
}
exports.ActivityTracker = ActivityTracker;
exports.default = ActivityTracker;
//# sourceMappingURL=ActivityTracker.js.map