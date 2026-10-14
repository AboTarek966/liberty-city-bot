import { Client, Guild, GuildMember, TextChannel, CategoryChannel, EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { ITicket } from '../models';
export interface TicketPanelOption {
    label: string;
    description?: string;
    emoji?: string;
}
export interface TicketPanelData {
    id: string;
    name: string;
    description: string;
    emoji: string;
    channelId: string;
    messageId?: string;
    type: 'button' | 'select';
    fields: Array<{
        id: string;
        label: string;
        placeholder: string;
        style: 'short' | 'paragraph';
        required: boolean;
    }>;
    /** أنواع التذاكر في قائمة اللوحة (اسم الخيار = اسم قناة التذكرة) */
    options?: TicketPanelOption[];
    supportRoleIds: string[];
    image?: string;
}
/** الأنواع الافتراضية عندما لا يحدد المشرف أي أنواع */
export declare const DEFAULT_TICKET_TYPES: TicketPanelOption[];
export interface CreateTicketOptions {
    guild: Guild;
    user: GuildMember;
    type: string;
    panelId?: string;
    subject?: string;
    fields?: Array<{
        question: string;
        answer: string;
    }>;
}
export declare class TicketHandler {
    private client;
    private activeTickets;
    private callCooldowns;
    /** ⚡ طابور إرسال سجلات التذاكر لكل سيرفر — ترتيب تام + لا يعطّل مسار التذكرة */
    private ticketLogQueues;
    constructor(client: Client);
    buildTicketControls(claimed: boolean): ActionRowBuilder<any>[];
    createTicketCategory(guild: Guild, name: string): Promise<CategoryChannel>;
    createLogChannel(guild: Guild, name: string, category?: CategoryChannel): Promise<TextChannel>;
    createTicket(options: CreateTicketOptions): Promise<ITicket>;
    closeTicket(channelId: string, closedBy: GuildMember, reason?: string): Promise<{
        ticket: ITicket;
        transcript: string;
    }>;
    sweepInactiveTickets(client: Client): Promise<void>;
    deleteTicket(channelId: string, deletedBy: GuildMember): Promise<void>;
    claimTicket(channelId: string, claimedBy: GuildMember): Promise<ITicket>;
    /** الأعمال الثقيلة بعد الاستلام — تعمل في الخلفية حتى يظهر الرد فوراً */
    private finalizeClaim;
    unclaimTicket(channelId: string, unclaimedBy: GuildMember): Promise<ITicket>;
    /** الأعمال الثقيلة بعد إلغاء الاستلام — تعمل في الخلفية حتى يظهر الرد فوراً */
    private finalizeUnclaim;
    reopenTicket(channelId: string, reopenedBy: GuildMember): Promise<ITicket>;
    /** الأعمال الثقيلة بعد إعادة الفتح — تعمل في الخلفية */
    private finalizeReopen;
    private applyClaimLock;
    private releaseClaimLock;
    private applyCloseLock;
    private restoreSnapshots;
    callAdmin(channelId: string, calledBy: GuildMember): Promise<void>;
    updateTicketButtons(channel: TextChannel, claimed: boolean): Promise<void>;
    addMemberToTicket(channelId: string, member: GuildMember, addedBy: GuildMember): Promise<void>;
    getTranscript(channelId: string): Promise<string>;
    private generateTranscript;
    private saveTranscript;
    private logTicketEvent;
    /** الإرسال الفعلي لسجل التذكرة */
    private emitTicketLog;
    createPanel(guild: Guild, channel: TextChannel, panelData: Omit<TicketPanelData, 'channelId' | 'messageId'>): Promise<{
        panel: TicketPanelData;
        messageId: string;
    }>;
    private getPanelTypes;
    buildPanelEmbed(panel: Partial<TicketPanelData>): EmbedBuilder;
    buildPanelComponents(panel: TicketPanelData): any[];
    updatePanelMessage(guild: Guild, panel: TicketPanelData): Promise<void>;
    movePanel(guild: Guild, panel: TicketPanelData, newChannel: TextChannel): Promise<void>;
    getActiveTickets(guildId: string): Promise<ITicket[]>;
    getUserTickets(guildId: string, userId: string): Promise<ITicket[]>;
    getTicketStats(guildId: string): Promise<{
        total: number;
        open: number;
        claimed: number;
        closed: number;
        waiting: number;
    }>;
    cleanup(): void;
}
export default TicketHandler;
//# sourceMappingURL=TicketHandler.d.ts.map