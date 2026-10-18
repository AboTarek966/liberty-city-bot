import { GuildMember } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
interface AltCheckResult {
    isAlt: boolean;
    reason: string;
    matchedAccounts: string[];
    action: 'kick' | 'ban' | 'quarantine' | 'log';
}
export declare class AntiAltHandler {
    private client;
    constructor(client: LibertyClient);
    onMemberJoin(member: GuildMember): Promise<void>;
    private checkForAlts;
    private calculateSimilarity;
    private levenshteinDistance;
    private executeAction;
    manualCheck(member: GuildMember): Promise<AltCheckResult>;
}
export default AntiAltHandler;
//# sourceMappingURL=AntiAltHandler.d.ts.map