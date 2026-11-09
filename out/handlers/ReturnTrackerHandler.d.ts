import { GuildMember } from 'discord.js';
import { OmniClient } from '../OmniClient';
export declare class ReturnTrackerHandler {
    private client;
    constructor(client: OmniClient);
    onMemberLeave(member: GuildMember): Promise<void>;
    onMemberJoin(member: GuildMember): Promise<{
        jailed: boolean;
    }>;
    private reapplyJail;
    private alertStaff;
}
export default ReturnTrackerHandler;
//# sourceMappingURL=ReturnTrackerHandler.d.ts.map