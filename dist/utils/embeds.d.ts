import { EmbedBuilder, Guild, User, GuildMember, TextChannel, ColorResolvable } from 'discord.js';
import 'moment-duration-format';
export declare const Colors: Record<string, ColorResolvable>;
export declare function createEmbed(options: {
    title?: string;
    description?: string;
    color?: ColorResolvable;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    footer?: {
        text: string;
        iconURL?: string;
    };
    thumbnail?: string;
    image?: string;
    author?: {
        name: string;
        iconURL?: string;
        url?: string;
    };
    timestamp?: boolean;
    url?: string;
}): EmbedBuilder;
export declare function successEmbed(title: string, description: string, footer?: string): EmbedBuilder;
export declare function errorEmbed(title: string, description: string, footer?: string): EmbedBuilder;
export declare function warningEmbed(title: string, description: string, footer?: string): EmbedBuilder;
export declare function infoEmbed(title: string, description: string, footer?: string): EmbedBuilder;
export declare function primaryEmbed(title: string, description: string, footer?: string): EmbedBuilder;
export declare function moderationEmbed(data: {
    type: 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unwarn' | 'timeout' | 'untimeout' | 'softban' | 'note' | 'role_add' | 'role_remove';
    moderator: User | GuildMember;
    target: User | GuildMember;
    reason: string;
    caseId: number;
    duration?: string;
    proof?: string;
    extraFields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
}): EmbedBuilder;
export declare function ticketEmbed(data: {
    title: string;
    description: string;
    user: User;
    type: string;
    status: 'open' | 'claimed' | 'waiting' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    claimedBy?: User;
    fields?: Array<{
        question: string;
        answer: string;
    }>;
}): EmbedBuilder;
export declare function ticketTranscriptEmbed(data: {
    ticketId: string;
    user: User;
    type: string;
    status: string;
    messages: Array<{
        author: User;
        content: string;
        timestamp: Date;
    }>;
    closedBy?: User;
    closeReason?: string;
}): EmbedBuilder;
export declare function simpleModMessage(action: 'ban' | 'kick' | 'timeout' | 'untimeout' | 'warn' | 'unwarn' | 'mute' | 'unmute' | 'role_add' | 'role_remove' | 'promote' | 'jail' | 'lockdown', target: User | GuildMember, moderator: User | GuildMember, reason: string, duration?: string): string;
export declare function logEmbed(data: {
    title: string;
    description: string;
    color: ColorResolvable;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    user?: User;
    channel?: TextChannel;
}): EmbedBuilder;
export declare function welcomeEmbed(data: {
    user: User;
    guild: Guild;
    memberCount: number;
    message: string;
    embedColor: string;
    embedTitle: string;
    embedThumbnail?: string;
    imageEnabled?: boolean;
    imageBackground?: string;
}): EmbedBuilder;
export declare function leaveEmbed(data: {
    user: User;
    guild: Guild;
    memberCount: number;
    message: string;
    embedColor: string;
}): EmbedBuilder;
export declare function userInfoEmbed(data: {
    user: User;
    member?: GuildMember;
    roles?: string[];
    joinedAt?: Date;
    createdAt: Date;
    badges?: string[];
}): EmbedBuilder;
export declare function serverInfoEmbed(data: {
    guild: Guild;
    owner: User;
    memberCount: number;
    botCount: number;
    channelCount: number;
    roleCount: number;
    emojiCount: number;
    boostLevel: number;
    boostCount: number;
    createdAt: Date;
    features: string[];
}): EmbedBuilder;
export declare function helpEmbed(data: {
    title: string;
    description: string;
    categories: Array<{
        name: string;
        commands: string[];
        emoji: string;
    }>;
    prefix: string;
}): EmbedBuilder;
export declare function createPaginationEmbeds(items: string[], options: {
    title: string;
    color?: ColorResolvable;
    itemsPerPage?: number;
    footer?: string;
}): EmbedBuilder[];
export declare function createProgressBar(current: number, max: number, length?: number): string;
export declare function formatNumber(num: number): string;
export declare function formatDuration(ms: number): string;
export declare function formatDate(date: Date): string;
export declare function formatRelativeTime(date: Date): string;
//# sourceMappingURL=embeds.d.ts.map