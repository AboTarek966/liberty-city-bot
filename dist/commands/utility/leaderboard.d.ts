import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, Guild } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
export type LBType = 'all' | 'messages' | 'voiceMinutes';
export type LBPeriod = 'day' | 'week' | 'month' | 'total';
export type LBLimit = '10' | '25' | 'all';
/** عدد الأعضاء في كل صفحة — مطابق للشكل المطلوب (5 صفوف) */
export declare const LB_PAGE_SIZE = 5;
export declare function formatMinutes(total: number): string;
export declare function periodLabel(period: LBPeriod): string;
export declare function limitNumber(limit: LBLimit): number;
export interface LBRow {
    userId: string;
    messages: number;
    voiceMinutes: number;
    score: number;
}
export declare function fetchLeaderboardRows(client: LibertyClient, guildId: string, period: LBPeriod, type: LBType, limit: LBLimit): Promise<LBRow[]>;
export interface LBPage {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
    page: number;
    totalPages: number;
    totalRows: number;
}
export declare function clampPage(page: number, totalPages: number): number;
export declare function buildLeaderboardPage(client: LibertyClient, guild: Guild, type: LBType, period: LBPeriod, limit: LBLimit, page: number): Promise<LBPage>;
export declare function buildLeaderboardComponents(type: LBType, period: LBPeriod, limit: LBLimit, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder>[];
export declare function sanitizeType(v?: string | null): LBType;
export declare function sanitizePeriod(v?: string | null): LBPeriod;
export declare function sanitizeLimit(v?: string | null): LBLimit;
declare const command: Command;
export default command;
//# sourceMappingURL=leaderboard.d.ts.map