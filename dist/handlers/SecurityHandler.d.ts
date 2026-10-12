import { Client, Guild, GuildMember, Role } from 'discord.js';
export declare class SecurityHandler {
    private client;
    private deletionTracker;
    private backupTimers;
    constructor(client: Client);
    cleanup(): void;
    private getAlertChannel;
    private findExecutor;
    private punish;
    private track;
    onChannelDelete(channel: any): Promise<void>;
    onRoleDelete(role: any): Promise<void>;
    onBanAdd(ban: any): Promise<void>;
    private respondMassDeletion;
    onMemberJoin(member: GuildMember): Promise<boolean>;
    onRoleUpdate(oldRole: Role, newRole: Role): Promise<void>;
    syncAutoBackup(guild: Guild, forceNow?: boolean): Promise<void>;
    createBackup(guild: Guild): Promise<{
        channels: number;
        roles: number;
        size: number;
    }>;
    restoreBackup(guild: Guild, backupIndex?: number): Promise<{
        channels: number;
        roles: number;
        skipped: number;
    }>;
    listBackups(guildId: string): Promise<Array<{
        index: number;
        date: Date;
        size: number;
        channels: number;
        roles: number;
    }>>;
}
//# sourceMappingURL=SecurityHandler.d.ts.map