import { Guild, GuildMember, TextChannel, Role, AttachmentBuilder } from 'discord.js';
export declare function parseDuration(input: string): number | null;
export declare function formatDuration(ms: number, options?: {
    compact?: boolean;
    locale?: string;
}): string;
export declare function getRelativeTime(date: Date): string;
export declare function formatDate(date: Date, format?: string): string;
export declare function truncate(str: string, length: number, suffix?: string): string;
export declare function cleanText(text: string): string;
export declare function escapeMarkdown(text: string): string;
export declare function removeMarkdown(text: string): string;
export declare function generateId(length?: number): string;
export declare function generateNumericId(length?: number): string;
export declare function slugify(text: string): string;
export declare function formatNumber(num: number, locale?: string): string;
export declare function randomInt(min: number, max: number): number;
export declare function clamp(num: number, min: number, max: number): number;
export declare function roundTo(num: number, decimals: number): number;
export declare function chunkArray<T>(array: T[], size: number): T[][];
export declare function shuffleArray<T>(array: T[]): T[];
export declare function uniqueArray<T>(array: T[]): T[];
export declare function paginateArray<T>(array: T[], page: number, perPage: number): T[];
export declare function hasPermission(member: GuildMember, permission: bigint | bigint[], checkAdmin?: boolean): boolean;
export declare function hasBotPermission(guild: Guild, permission: bigint | bigint[]): boolean;
export declare function getHighestRole(member: GuildMember): Role | null;
export declare function canModerate(moderator: GuildMember, target: GuildMember): boolean;
export declare function getTextChannels(guild: Guild): TextChannel[];
export declare function findChannel(guild: Guild, name: string): TextChannel | undefined;
export declare function findRole(guild: Guild, name: string): Role | undefined;
export declare function createMuteRole(guild: Guild): Promise<Role>;
export declare function applyMuteRole(guild: Guild, muteRole: Role): Promise<void>;
export declare function parseUserMention(mention: string): string | null;
export declare function parseRoleMention(mention: string): string | null;
export declare function parseChannelMention(mention: string): string | null;
export declare function isValidUrl(url: string): boolean;
/**
 * استخراج الروابط من النص — يلتقط الروابط الكاملة (https://…)
 * والنطاقات بدون بروتوكول (example.com/path) مع تجنب
 * الالتقاط الخاطئ مثل أسماء الملفات (bot.js).
 */
export declare function extractUrls(text: string): string[];
export declare function containsInvite(text: string): boolean;
export declare function extractInvites(text: string): string[];
export declare function isZalgo(text: string): boolean;
export declare function getCapsPercentage(text: string): number;
export declare function countEmojis(text: string): number;
export declare function calculateLevel(xp: number): number;
export declare function calculateXpForLevel(level: number): number;
export declare function getXpProgress(xp: number): {
    current: number;
    next: number;
    progress: number;
};
export declare function createAttachment(buffer: Buffer, name: string): AttachmentBuilder;
export declare function isImageUrl(url: string): boolean;
export declare function isVideoUrl(url: string): boolean;
export declare function setCooldown(key: string, userId: string, duration: number): void;
export declare function checkCooldown(key: string, userId: string): {
    onCooldown: boolean;
    remaining: number;
};
export declare function clearCooldown(key: string, userId: string): void;
export declare function isValidUserId(id: string): boolean;
export declare function isValidGuildId(id: string): boolean;
export declare function isValidChannelId(id: string): boolean;
export declare function isValidRoleId(id: string): boolean;
export declare function isValidMessageId(id: string): boolean;
export declare function sleep(ms: number): Promise<void>;
export declare function retry<T>(fn: () => Promise<T>, retries?: number, delay?: number, backoff?: number): Promise<T>;
export declare function timeout<T>(promise: Promise<T>, ms: number, error?: Error): Promise<T>;
export declare function isDevelopment(): boolean;
export declare function isProduction(): boolean;
export declare function createLogger(prefix: string): {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    success: (...args: any[]) => void;
};
//# sourceMappingURL=helpers.d.ts.map