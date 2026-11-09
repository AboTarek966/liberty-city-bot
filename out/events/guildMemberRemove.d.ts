import { GuildMember } from 'discord.js';
import { Event } from '../handlers/EventHandler';
declare const event: Event;
export type LeaveResult = 'sent' | 'disabled' | 'no-channel' | 'bad-channel' | 'failed';
export declare function handleLeave(member: GuildMember, opts?: {
    force?: boolean;
}): Promise<LeaveResult>;
export default event;
//# sourceMappingURL=guildMemberRemove.d.ts.map