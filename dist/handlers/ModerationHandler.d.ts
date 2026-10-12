import { Client, Guild, GuildMember, User } from 'discord.js';
export type ModerationAction = 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unwarn' | 'timeout' | 'untimeout' | 'softban' | 'note';
export interface ModerationOptions {
    guild: Guild;
    moderator: GuildMember;
    target: GuildMember | User;
    reason: string;
    duration?: string;
    proof?: string;
}
export declare class ModerationHandler {
    private client;
    constructor(client: Client);
    ban(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
    }>;
    kick(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
    }>;
    timeout(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
    }>;
    removeTimeout(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
    }>;
    warn(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
        warningCount: number;
    }>;
    unwarn(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
        warningCount: number;
    }>;
    private checkWarningThreshold;
    mute(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
    }>;
    unmute(options: ModerationOptions): Promise<{
        case: any;
        embed: any;
    }>;
    addRole(options: {
        guild: Guild;
        moderator: GuildMember;
        target: GuildMember;
        reason: string;
        roleId: string;
    }): Promise<{
        case: any;
        embed: any;
        simpleMsg: string;
    }>;
    addRoles(options: {
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
    }>;
    removeRole(options: {
        guild: Guild;
        moderator: GuildMember;
        target: GuildMember;
        reason: string;
        roleId: string;
    }): Promise<{
        case: any;
        embed: any;
        simpleMsg: string;
    }>;
    private getMuteRole;
    getWarnings(guildId: string, userId: string): Promise<any[]>;
    removeWarning(guildId: string, userId: string, warningId?: string): Promise<number>;
    getCases(guildId: string, options?: {
        userId?: string;
        moderatorId?: string;
        type?: ModerationAction;
        limit?: number;
    }): Promise<any[]>;
    private canModerate;
    private sendDM;
    private logAction;
}
export default ModerationHandler;
//# sourceMappingURL=ModerationHandler.d.ts.map