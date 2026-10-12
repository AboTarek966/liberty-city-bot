import { Client, GuildMember, EmbedBuilder } from 'discord.js';
import { IUserProfile } from '../models';
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
    progress: {
        current: number;
        next: number;
        progress: number;
    };
}
export declare class LevelingHandler {
    private client;
    private xpCooldowns;
    private voiceJoins;
    constructor(client: Client);
    calculateLevel(xp: number): number;
    xpForLevel(level: number): number;
    getXpProgress(xp: number): {
        current: number;
        next: number;
        progress: number;
    };
    getOrCreateProfile(userId: string, guildId: string): Promise<IUserProfile>;
    addMessageXp(member: GuildMember, channelId: string): Promise<LevelUpResult | null>;
    trackVoiceJoin(guildId: string, userId: string): Promise<void>;
    addVoiceXp(guildId: string, userId: string): Promise<LevelUpResult | null>;
    creditActiveVoiceSessions(): Promise<void>;
    handleLevelUp(member: GuildMember, oldLevel: number, newLevel: number, fallbackChannelId?: string): Promise<void>;
    private buildVars;
    private applyVars;
    sendLevelUpMessage(member: GuildMember, level: number, fallbackChannelId?: string): Promise<void>;
    private parseColor;
    assignLevelRewards(member: GuildMember, level: number): Promise<string[]>;
    getRank(userId: string, guildId: string): Promise<number>;
    getMemberCount(guildId: string): Promise<number>;
    buildRankCard(member: GuildMember): Promise<EmbedBuilder>;
    getTopMembers(guildId: string, limit?: number): Promise<(import("mongoose").FlattenMaps<IUserProfile> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    cleanup(): void;
}
export default LevelingHandler;
//# sourceMappingURL=LevelingHandler.d.ts.map