import { Client, Guild, TextChannel, User, ChatInputCommandInteraction, GuildMember, EmbedBuilder } from 'discord.js';
export interface BotConfig {
    token: string;
    clientId: string;
    guildId?: string;
    prefix: string;
    defaultLanguage: string;
    timezone: string;
    colors: {
        primary: string;
        success: string;
        warning: string;
        error: string;
        info: string;
    };
}
export interface DatabaseConfig {
    uri: string;
    options?: mongoose.ConnectOptions;
}
export interface AIConfig {
    provider: 'openai' | 'anthropic' | 'groq' | 'both' | 'auto';
    openai?: {
        apiKey: string;
        model: string;
        maxTokens: number;
        temperature: number;
    };
    groq?: {
        apiKey: string;
        model: string;
        maxTokens: number;
        temperature: number;
    };
    anthropic?: {
        apiKey: string;
        model: string;
        maxTokens: number;
    };
    systemPrompt: string;
    enabled: boolean;
    cooldown: number;
}
export interface ProtectionConfig {
    antiRaid: AntiRaidConfig;
    antiSpam: AntiSpamConfig;
    antiLink: AntiLinkConfig;
    antiInvite: AntiInviteConfig;
    antiMention: AntiMentionConfig;
    antiCaps: AntiCapsConfig;
    antiEmoji: AntiEmojiConfig;
}
export interface AntiRaidConfig {
    enabled: boolean;
    threshold: number;
    timeWindow: number;
    action: 'kick' | 'ban' | 'lockdown';
}
export interface AntiSpamConfig {
    enabled: boolean;
    maxMessages: number;
    timeWindow: number;
    action: 'warn' | 'mute' | 'kick' | 'ban';
    muteDuration: number;
}
export interface AntiLinkConfig {
    enabled: boolean;
    whitelist: string[];
    action: 'delete' | 'warn' | 'mute';
    ignoreRoles: string[];
}
export interface AntiInviteConfig {
    enabled: boolean;
    action: 'delete' | 'warn' | 'mute';
    ignoreRoles: string[];
}
export interface AntiMentionConfig {
    enabled: boolean;
    max: number;
    action: 'delete' | 'warn' | 'mute';
}
export interface AntiCapsConfig {
    enabled: boolean;
    minLength: number;
    percentage: number;
    action: 'delete' | 'warn' | 'mute';
}
export interface AntiEmojiConfig {
    enabled: boolean;
    max: number;
    action: 'delete' | 'warn' | 'mute';
}
export interface TicketConfig {
    categoryName: string;
    logChannelName: string;
    transcriptChannelName: string;
    maxPerUser: number;
    autoCloseHours: number;
    supportRoles: string[];
}
export interface LoggingConfig {
    level: string;
    channelId?: string;
    types: LogType[];
}
export type LogType = 'messageDelete' | 'messageUpdate' | 'memberJoin' | 'memberLeave' | 'roleCreate' | 'roleDelete' | 'channelCreate' | 'channelDelete' | 'banAdd' | 'banRemove' | 'voiceStateUpdate' | 'ticketCreate' | 'ticketClose' | 'ticketDelete' | 'moderationAction';
export interface WelcomeConfig {
    enabled: boolean;
    channelName: string;
    message: string;
    dmEnabled: boolean;
    dmMessage: string;
    imageEnabled: boolean;
    imageBackground?: string;
}
export interface LeaveConfig {
    enabled: boolean;
    channelName: string;
    message: string;
}
export interface AutoModConfig {
    enabled: boolean;
    badWords: string[];
    badWordsAction: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
    badWordsDuration: number;
    zalgoEnabled: boolean;
    zalgoAction: 'delete' | 'warn' | 'mute';
}
export interface EconomyConfig {
    enabled: boolean;
}
export interface LevelingConfig {
    enabled: boolean;
    xpPerMessage: number;
    xpCooldown: number;
    levelUpChannelName: string;
    levelRoles: Record<number, string>;
}
export interface DashboardConfig {
    enabled: boolean;
    port: number;
    secret: string;
    callbackUrl: string;
    oauth2Secret: string;
}
export interface CommandOptions {
    name: string;
    description: string;
    descriptionEn?: string;
    category: CommandCategory;
    permissions?: bigint[];
    userPermissions?: bigint[];
    botPermissions?: bigint[];
    cooldown?: number;
    ownerOnly?: boolean;
    guildOnly?: boolean;
    nsfw?: boolean;
    options?: CommandOption[];
    subcommands?: SubcommandOptions[];
}
export type CommandCategory = 'moderation' | 'protection' | 'tickets' | 'settings' | 'ai' | 'utility' | 'info' | 'owner' | 'fun' | 'economy';
export interface CommandOption {
    name: string;
    nameEn?: string;
    description: string;
    descriptionEn?: string;
    type: number;
    required?: boolean;
    choices?: CommandChoice[];
    options?: CommandOption[];
    minValue?: number;
    maxValue?: number;
    channelTypes?: number[];
}
export interface CommandChoice {
    name: string;
    nameEn?: string;
    value: string | number;
}
export interface SubcommandOptions {
    name: string;
    nameEn?: string;
    description: string;
    descriptionEn?: string;
    options?: CommandOption[];
}
export interface CommandContext {
    client: Client;
    interaction: ChatInputCommandInteraction;
    guild: Guild;
    member: GuildMember;
    channel: TextChannel;
    user: User;
    t: TFunction;
    args: Record<string, any>;
}
export interface EventOptions {
    name: string;
    once?: boolean;
    enabled?: boolean;
}
export interface GuildSettings {
    guildId: string;
    prefix: string;
    language: string;
    timezone: string;
    protection: ProtectionSettings;
    tickets: TicketSettings;
    logging: LoggingSettings;
    welcome: WelcomeSettings;
    leave: LeaveSettings;
    automod: AutoModSettings;
    economy: EconomySettings;
    leveling: LevelingSettings;
    ai: AISettings;
    customCommands: CustomCommand[];
    tags: Tag[];
    reactionRoles: ReactionRole[];
    updatedAt: Date;
}
export interface ProtectionSettings {
    antiRaid: AntiRaidConfig & {
        logChannel?: string;
    };
    antiSpam: AntiSpamConfig & {
        logChannel?: string;
    };
    antiLink: AntiLinkConfig & {
        logChannel?: string;
    };
    antiInvite: AntiInviteConfig & {
        logChannel?: string;
    };
    antiMention: AntiMentionConfig & {
        logChannel?: string;
    };
    antiCaps: AntiCapsConfig & {
        logChannel?: string;
    };
    antiEmoji: AntiEmojiConfig & {
        logChannel?: string;
    };
}
export interface TicketSettings {
    categoryId?: string;
    logChannelId?: string;
    transcriptChannelId?: string;
    supportRoleIds: string[];
    maxPerUser: number;
    autoCloseHours: number;
    panels: TicketPanel[];
}
export interface TicketPanel {
    id: string;
    name: string;
    description: string;
    emoji: string;
    channelId: string;
    messageId?: string;
    type: 'button' | 'select';
    fields: TicketField[];
    supportRoleIds: string[];
}
export interface TicketField {
    id: string;
    label: string;
    placeholder: string;
    style: 'short' | 'paragraph';
    required: boolean;
}
export interface LoggingSettings {
    enabled: boolean;
    channelId?: string;
    types: LogType[];
    ignoredChannels: string[];
    ignoredRoles: string[];
}
export interface WelcomeSettings {
    enabled: boolean;
    channelId?: string;
    message: string;
    dmEnabled: boolean;
    dmMessage: string;
    imageEnabled: boolean;
    imageBackground?: string;
    embedColor: string;
    embedTitle: string;
    embedThumbnail?: string;
}
export interface LeaveSettings {
    enabled: boolean;
    channelId?: string;
    message: string;
    embedColor: string;
}
export interface AutoModSettings {
    enabled: boolean;
    badWords: string[];
    badWordsAction: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
    badWordsDuration: number;
    zalgoEnabled: boolean;
    zalgoAction: 'delete' | 'warn' | 'mute';
    ignoredRoles: string[];
    ignoredChannels: string[];
}
export interface EconomySettings {
    enabled: boolean;
    currency: string;
    currencySymbol: string;
    dailyAmount: number;
    workAmount: {
        min: number;
        max: number;
    };
    begAmount: {
        min: number;
        max: number;
    };
    robEnabled: boolean;
    robCooldown: number;
    slotsEnabled: boolean;
    blackjackEnabled: boolean;
}
export interface LevelingSettings {
    enabled: boolean;
    xpPerMessage: number;
    xpCooldown: number;
    levelUpChannelId?: string;
    levelUpMessage: string;
    levelRoles: Record<number, string>;
    xpGainMultiplier: number;
    voiceXpPerMinute: number;
    ignoredChannels: string[];
    ignoredRoles: string[];
}
export interface AISettings {
    enabled: boolean;
    provider: 'openai' | 'anthropic' | 'groq' | 'both' | 'auto';
    model: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    cooldown: number;
    allowedChannels: string[];
    allowedRoles: string[];
    ignoredChannels: string[];
    ignoredRoles: string[];
    responseLanguage: string;
}
export interface CustomCommand {
    name: string;
    content: string;
    embed?: boolean;
    /** نطاق الأمر: 'public' يرد لأي عضو · 'admin' لا يرد إلا لحاملي صلاحية Administrator */
    scope?: 'public' | 'admin';
    createdBy: string;
    createdAt: Date;
    uses: number;
}
export interface Tag {
    name: string;
    content: string;
    createdBy: string;
    createdAt: Date;
    uses: number;
}
export interface ReactionRole {
    messageId: string;
    channelId: string;
    roles: ReactionRoleEntry[];
}
export interface ReactionRoleEntry {
    emoji: string;
    roleId: string;
    type: 'unique' | 'multiple';
}
export interface ModerationCase {
    _id?: string;
    guildId: string;
    caseId: number;
    type: ModerationType;
    moderatorId: string;
    targetId: string;
    reason: string;
    duration?: number;
    expiresAt?: Date;
    proof?: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export type ModerationType = 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unwarn' | 'timeout' | 'untimeout' | 'softban' | 'note';
export interface Warning {
    _id?: string;
    guildId: string;
    userId: string;
    moderatorId: string;
    reason: string;
    caseId: number;
    createdAt: Date;
}
export interface MuteRole {
    guildId: string;
    roleId: string;
    createdAt: Date;
}
export interface Ticket {
    _id?: string;
    guildId: string;
    channelId: string;
    userId: string;
    type: string;
    panelId?: string;
    status: TicketStatus;
    claimedBy?: string;
    priority: TicketPriority;
    subject?: string;
    fields: TicketFieldResponse[];
    transcript?: string;
    closedBy?: string;
    closeReason?: string;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
}
export type TicketStatus = 'open' | 'claimed' | 'waiting' | 'closed' | 'deleted';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export interface TicketFieldResponse {
    question: string;
    answer: string;
}
export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface AIChatSession {
    userId: string;
    guildId?: string;
    channelId?: string;
    messages: AIMessage[];
    lastActivity: Date;
    tokenCount: number;
}
export interface AIResponse {
    content: string;
    tokensUsed: number;
    model: string;
    finishReason: string;
}
export interface TFunction {
    (key: string, options?: Record<string, any>): string;
}
export interface PaginatedEmbedOptions {
    title: string;
    description?: string;
    color?: string;
    footer?: string;
    thumbnail?: string;
    image?: string;
    fields: EmbedField[];
    itemsPerPage: number;
}
export interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}
export interface PaginationData {
    embeds: EmbedBuilder[];
    currentPage: number;
    totalPages: number;
}
declare module 'discord.js' {
    interface Client {
        config: BotConfig;
        db: typeof import('mongoose');
        commands: Map<string, BaseCommand>;
        cooldowns: Map<string, Map<string, number>>;
        ticketPanels: Map<string, TicketPanel>;
        aiSessions: Map<string, AIChatSession>;
    }
    interface Guild {
        settings?: GuildSettings;
        getSettings(): Promise<GuildSettings>;
    }
    interface GuildMember {
        hasPermission(permission: bigint | bigint[]): boolean;
    }
}
export declare abstract class BaseCommand {
    readonly options: CommandOptions;
    constructor(options: CommandOptions);
    abstract execute(context: CommandContext): Promise<void>;
    checkPermissions(context: CommandContext): Promise<boolean>;
    checkCooldown(context: CommandContext, userId: string): boolean;
}
export declare abstract class BaseEvent {
    readonly options: EventOptions;
    constructor(options: EventOptions);
    abstract execute(...args: any[]): Promise<void>;
}
import mongoose from 'mongoose';
//# sourceMappingURL=index.d.ts.map