import { Guild, GuildMember } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
export declare class InviteTrackerHandler {
    private client;
    private inviteCache;
    private joinTracker;
    constructor(client: LibertyClient);
    private initializeTracking;
    clearGuild(guildId: string): void;
    cacheGuildInvites(guild: Guild): Promise<void>;
    private onInviteCreate;
    private onInviteDelete;
    onMemberJoin(member: GuildMember): Promise<{
        inviteCode: string | null;
        inviterId: string | null;
        isSuspicious: boolean;
    }>;
    private recordJoin;
    private checkSuspiciousInvite;
    private handleSuspicious;
    onMemberLeave(member: GuildMember): Promise<void>;
    getInviteStats(guild: Guild, userId: string): Promise<{
        totalInvites: number;
        regularInvites: number;
        leftInvites: number;
        fakeInvites: number;
        rank: number;
    }>;
    checkAndGiveReward(guild: Guild, inviterId: string, totalInvites: number): Promise<void>;
    refreshCache(guild: Guild): Promise<void>;
}
export default InviteTrackerHandler;
//# sourceMappingURL=InviteTrackerHandler.d.ts.map