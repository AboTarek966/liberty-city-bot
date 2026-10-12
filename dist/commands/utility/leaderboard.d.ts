import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
export type LBType = 'all' | 'messages' | 'voiceMinutes';
export type LBPeriod = 'day' | 'week' | 'month' | 'total';
export type LBLimit = '10' | '25' | 'all';
export declare function formatMinutes(total: number): string;
export declare function periodLabel(period: LBPeriod): string;
export declare function buildLeaderboardEmbed(client: LibertyClient, guildId: string, type: LBType, period: LBPeriod, limit: LBLimit): Promise<EmbedBuilder>;
export declare function buildLeaderboardButtons(type: LBType, period: LBPeriod, limit: LBLimit): ActionRowBuilder<ButtonBuilder>[];
declare const command: Command;
export default command;
//# sourceMappingURL=leaderboard.d.ts.map