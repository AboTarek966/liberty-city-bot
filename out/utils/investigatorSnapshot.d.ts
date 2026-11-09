import { Guild, Message } from 'discord.js';
import { BufferedMessage, EventSignal, GuildSnapshot, MessageSnapshot, SecuritySnapshot, SnapshotOptions } from '../types/investigator';
declare const TRUSTED_BOT_IDS: string[];
export declare function buildSecuritySnapshot(guild: Guild, settings: any): SecuritySnapshot;
export declare function messageToSnapshot(message: Message, channelName: string, protectedIds: Set<string>): MessageSnapshot;
export declare function collectGuildSnapshot(guild: Guild, options: SnapshotOptions, extra?: {
    settings?: any;
    signals?: EventSignal[];
    bufferedMessages?: BufferedMessage[];
    protectedIds?: Set<string>;
}): Promise<GuildSnapshot>;
export { TRUSTED_BOT_IDS };
//# sourceMappingURL=investigatorSnapshot.d.ts.map