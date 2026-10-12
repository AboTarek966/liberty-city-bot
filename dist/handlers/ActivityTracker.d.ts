import { Client } from 'discord.js';
import mongoose, { Document } from 'mongoose';
export interface IActivityStats extends Document {
    guildId: string;
    userId: string;
    period: 'day' | 'week' | 'month' | 'total';
    date: string;
    messages: number;
    voiceMinutes: number;
    voiceJoins: number;
    updatedAt: Date;
}
declare const ActivityStats: mongoose.Model<IActivityStats, {}, {}, {}, mongoose.Document<unknown, {}, IActivityStats, {}, {}> & IActivityStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
declare function getDayKey(d?: Date): string;
declare function getMonthKey(d?: Date): string;
declare function getWeekKey(d?: Date): string;
export declare class ActivityTracker {
    private client;
    private voiceJoins;
    private flushTimer;
    constructor(client: Client);
    private pendingMessages;
    trackMessage(guildId: string, userId: string): Promise<void>;
    private flushMessages;
    private handleVoiceState;
    private addVoiceJoin;
    private addVoiceTime;
    private flushVoiceTime;
    creditActiveSessions(): Promise<void>;
    getStats(guildId: string, userId: string, period: 'day' | 'week' | 'month' | 'total'): Promise<{
        messages: number;
        voiceMinutes: number;
        voiceJoins: number;
    }>;
    getStatsAllPeriods(guildId: string, userId: string): Promise<{
        day: {
            messages: number;
            voiceMinutes: number;
            voiceJoins: number;
        };
        week: {
            messages: number;
            voiceMinutes: number;
            voiceJoins: number;
        };
        month: {
            messages: number;
            voiceMinutes: number;
            voiceJoins: number;
        };
        total: {
            messages: number;
            voiceMinutes: number;
            voiceJoins: number;
        };
    }>;
    getLeaderboard(guildId: string, period: 'day' | 'week' | 'month' | 'total', type: 'messages' | 'voiceMinutes', limit?: number): Promise<(mongoose.FlattenMaps<IActivityStats> & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    cleanup(): void;
}
export default ActivityTracker;
export { ActivityStats, getDayKey, getWeekKey, getMonthKey };
//# sourceMappingURL=ActivityTracker.d.ts.map