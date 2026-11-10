import { Client, Guild, GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { IGiveaway, IGiveawayRequirements } from '../models';
export interface CreateGiveawayInput {
    guildId: string;
    channelId: string;
    hostId: string;
    prize: string;
    description?: string;
    winnersCount: number;
    durationMs: number;
    requirements: Partial<IGiveawayRequirements>;
}
export interface GiveawayResult {
    ok: boolean;
    reason?: string;
    left?: boolean;
    giveaway?: IGiveaway;
    winners?: string[];
}
export declare function generateShortId(length?: number): string;
export declare function formatRemaining(ms: number): string;
export declare function uniqueEntryCount(giveaway: Pick<IGiveaway, 'entries'>): number;
export declare function dedupeGiveawayEntries(giveaway: IGiveaway): boolean;
export declare function requirementLines(req?: Partial<IGiveawayRequirements>): string[];
export declare function invalidateInviteCache(guildId: string): void;
export declare function checkGiveawayRequirements(guild: Guild, member: GuildMember, requirements: Partial<IGiveawayRequirements>, inviteCounts?: Map<string, number>): Promise<string[]>;
export declare function buildGiveawayPayload(giveaway: IGiveaway, state?: {
    ended?: boolean;
    winners?: string[];
    awaitingWinner?: boolean;
}, guildName?: string): {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
};
export declare function refreshGiveawayMessage(client: Client, giveaway: IGiveaway): Promise<void>;
export declare function createGiveaway(input: CreateGiveawayInput): Promise<IGiveaway>;
export declare function findGiveaway(guildId: string, ref: string): Promise<IGiveaway | null>;
export declare function toggleGiveawayEntry(client: Client, guildId: string, ref: string, member: GuildMember): Promise<GiveawayResult>;
export declare function endGiveaway(client: Client, guildId: string, ref: string): Promise<GiveawayResult>;
export declare function findDefaultGiveawayForWinner(guildId: string): Promise<IGiveaway | null>;
/**
 * يعلن الفائزين يدوياً لسحب معيّن (أو الافتراضي).
 * - ينهي السحب إن لم ينتهِ بعد.
 * - يدمج الفائزين مع القائمة الحالية (بدون تكرار).
 */
export declare function addGiveawayWinners(client: Client, guildId: string, ref: string | undefined, winnerIds: string[]): Promise<GiveawayResult & {
    awaitingWinner?: boolean;
    finishedNow?: boolean;
}>;
/** استخراج معرّفات المنشن من نص رسالة — <@!id> أو <@id> أو آيدي خام */
export declare function parseUserMentions(text: string): string[];
export declare function rerollGiveaway(client: Client, guildId: string, ref: string, winnersCount?: number): Promise<GiveawayResult>;
export declare function clearGiveawayTimer(giveawayId: string): void;
export declare function scheduleGiveaway(client: Client, giveaway: IGiveaway): void;
export declare function restoreGiveaways(client: Client): Promise<void>;
//# sourceMappingURL=giveaway.d.ts.map