import { Guild } from 'discord.js';
export interface LockdownResult {
    textChannels: number;
    voiceChannels: number;
}
export declare function setLockdown(guild: Guild, enabled: boolean): Promise<LockdownResult>;
//# sourceMappingURL=lockdown.d.ts.map