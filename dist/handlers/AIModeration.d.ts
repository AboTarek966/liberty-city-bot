import { Message, Guild, GuildMember } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
export declare function runSequentialWarn(opts: {
    guild: Guild;
    moderator: GuildMember;
    targetMember: GuildMember;
    level: number;
    reason: string;
}): Promise<string>;
export declare function executeAIModeration(message: Message, client: LibertyClient, question: string): Promise<boolean>;
//# sourceMappingURL=AIModeration.d.ts.map