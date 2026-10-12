import { GuildMember } from 'discord.js';
import { Event } from '../handlers/EventHandler';
declare const event: Event;
export type WelcomeResult = 'sent' | 'disabled' | 'no-channel' | 'bad-channel' | 'failed';
export declare function handleWelcome(member: GuildMember, opts?: {
    force?: boolean;
}): Promise<WelcomeResult>;
export default event;
//# sourceMappingURL=guildMemberAdd.d.ts.map