import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, Guild } from 'discord.js';
export type TicketTopPeriod = 'day' | 'week' | 'month' | 'total';
export declare const TICKET_TOP_PERIODS: TicketTopPeriod[];
export declare function sanitizeTicketTopPeriod(v?: string | null): TicketTopPeriod;
export declare function ticketPeriodLabel(period: TicketTopPeriod): string;
export interface TicketTopPage {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
    page: number;
    totalPages: number;
    totalAdmins: number;
}
export declare function buildTicketTopPage(guild: Guild, period: TicketTopPeriod, page: number): Promise<TicketTopPage>;
export declare function buildTicketTopComponents(period: TicketTopPeriod, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder>[];
//# sourceMappingURL=ticketTop.d.ts.map