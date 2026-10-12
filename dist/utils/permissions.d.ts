import { GuildMember, Guild, TextChannel, Role } from 'discord.js';
export declare const PERMISSIONS: {
    readonly ADMINISTRATOR: bigint;
    readonly MANAGE_GUILD: bigint;
    readonly MANAGE_ROLES: bigint;
    readonly MANAGE_CHANNELS: bigint;
    readonly MANAGE_EMOJIS_AND_STICKERS: bigint;
    readonly MANAGE_WEBHOOKS: bigint;
    readonly KICK_MEMBERS: bigint;
    readonly BAN_MEMBERS: bigint;
    readonly MODERATE_MEMBERS: bigint;
    readonly MUTE_MEMBERS: bigint;
    readonly DEAFEN_MEMBERS: bigint;
    readonly MOVE_MEMBERS: bigint;
    readonly MANAGE_MESSAGES: bigint;
    readonly MANAGE_THREADS: bigint;
    readonly SEND_MESSAGES: bigint;
    readonly SEND_MESSAGES_IN_THREADS: bigint;
    readonly EMBED_LINKS: bigint;
    readonly ATTACH_FILES: bigint;
    readonly READ_MESSAGE_HISTORY: bigint;
    readonly MENTION_EVERYONE: bigint;
    readonly USE_EXTERNAL_EMOJIS: bigint;
    readonly ADD_REACTIONS: bigint;
    readonly VIEW_CHANNEL: bigint;
    readonly CONNECT: bigint;
    readonly SPEAK: bigint;
    readonly STREAM: bigint;
    readonly USE_VAD: bigint;
    readonly PRIORITY_SPEAKER: bigint;
    readonly CREATE_INSTANT_INVITE: bigint;
    readonly CHANGE_NICKNAME: bigint;
    readonly MANAGE_NICKNAMES: bigint;
    readonly VIEW_AUDIT_LOG: bigint;
    readonly VIEW_GUILD_INSIGHTS: bigint;
};
export declare const PERMISSION_GROUPS: {
    readonly BOT_BASE: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    readonly MODERATION: readonly [bigint, bigint, bigint, bigint, bigint, bigint];
    readonly ADMIN: readonly [bigint, bigint, bigint, bigint, bigint, bigint];
    readonly TICKETS: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    readonly WELCOME_LOG: readonly [bigint, bigint, bigint, bigint, bigint];
    readonly VOICE: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
};
/**
 * Check if a member has a specific permission or any of the permissions in an array
 */
export declare function hasPermission(member: GuildMember, permissions: bigint | bigint[], checkAdmin?: boolean): boolean;
/**
 * Check if the bot has a specific permission in a guild
 */
export declare function hasBotPermission(guild: Guild, permissions: bigint | bigint[]): boolean;
/**
 * Check if the bot has a specific permission in a channel
 */
export declare function hasBotPermissionInChannel(channel: TextChannel, permissions: bigint | bigint[]): boolean;
/**
 * Check if a member can moderate another member
 */
export declare function canModerate(moderator: GuildMember, target: GuildMember): boolean;
/**
 * Check if a member can assign a role to another member
 */
export declare function canAssignRole(moderator: GuildMember, target: GuildMember, role: Role): boolean;
/**
 * Check if a member can remove a role from another member
 */
export declare function canRemoveRole(moderator: GuildMember, target: GuildMember, role: Role): boolean;
/**
 * Get missing permissions for a member
 */
export declare function getMissingPermissions(member: GuildMember, permissions: bigint[]): bigint[];
/**
 * Get missing permissions for the bot in a guild
 */
export declare function getBotMissingPermissions(guild: Guild, permissions: bigint[]): bigint[];
/**
 * Get missing permissions for the bot in a channel
 */
export declare function getBotMissingPermissionsInChannel(channel: TextChannel, permissions: bigint[]): bigint[];
/**
 * Format permission names for display (Arabic)
 */
export declare function formatPermissionName(permission: bigint): string;
/**
 * Format multiple permissions for display
 */
export declare function formatPermissions(permissions: bigint[]): string;
/**
 * Check if user is bot owner
 */
export declare function isBotOwner(userId: string, ownerId: string): boolean;
/**
 * Check if user is guild owner
 */
export declare function isGuildOwner(member: GuildMember): boolean;
/**
 * Get the highest role a member can manage
 */
export declare function getHighestManageableRole(member: GuildMember): Role | null;
/**
 * Check if bot can manage a role
 */
export declare function canBotManageRole(guild: Guild, role: Role): boolean;
/**
 * Permission flags for slash command default member permissions
 */
export declare const COMMAND_PERMISSIONS: {
    readonly BAN: bigint;
    readonly KICK: bigint;
    readonly MUTE: bigint;
    readonly UNMUTE: bigint;
    readonly TIMEOUT: bigint;
    readonly UNTIMEOUT: bigint;
    readonly WARN: bigint;
    readonly PURGE: bigint;
    readonly LOCKDOWN: bigint;
    readonly SLOWMODE: bigint;
    readonly PROTECTION_CONFIG: bigint;
    readonly ANTIRAID_CONFIG: bigint;
    readonly ANTISPAM_CONFIG: bigint;
    readonly ANTILINK_CONFIG: bigint;
    readonly TICKET_CREATE: bigint;
    readonly TICKET_CLOSE: bigint;
    readonly TICKET_CLAIM: bigint;
    readonly TICKET_CONFIG: bigint;
    readonly SETTINGS_VIEW: bigint;
    readonly SETTINGS_EDIT: bigint;
    readonly PREFIX: bigint;
    readonly LANGUAGE: bigint;
    readonly WELCOME_CONFIG: bigint;
    readonly LOG_CONFIG: bigint;
    readonly AI_CHAT: bigint;
    readonly AI_CONFIG: bigint;
    readonly USERINFO: bigint;
    readonly SERVERINFO: bigint;
    readonly AVATAR: bigint;
    readonly BANNER: bigint;
    readonly WEATHER: bigint;
    readonly BOT_OWNER: bigint;
    readonly EVAL: bigint;
    readonly RELOAD: bigint;
    readonly SHUTDOWN: bigint;
};
/**
 * Get required permissions for a command category
 */
export declare function getCategoryPermissions(category: string): bigint[];
declare const _default: {
    PERMISSIONS: {
        readonly ADMINISTRATOR: bigint;
        readonly MANAGE_GUILD: bigint;
        readonly MANAGE_ROLES: bigint;
        readonly MANAGE_CHANNELS: bigint;
        readonly MANAGE_EMOJIS_AND_STICKERS: bigint;
        readonly MANAGE_WEBHOOKS: bigint;
        readonly KICK_MEMBERS: bigint;
        readonly BAN_MEMBERS: bigint;
        readonly MODERATE_MEMBERS: bigint;
        readonly MUTE_MEMBERS: bigint;
        readonly DEAFEN_MEMBERS: bigint;
        readonly MOVE_MEMBERS: bigint;
        readonly MANAGE_MESSAGES: bigint;
        readonly MANAGE_THREADS: bigint;
        readonly SEND_MESSAGES: bigint;
        readonly SEND_MESSAGES_IN_THREADS: bigint;
        readonly EMBED_LINKS: bigint;
        readonly ATTACH_FILES: bigint;
        readonly READ_MESSAGE_HISTORY: bigint;
        readonly MENTION_EVERYONE: bigint;
        readonly USE_EXTERNAL_EMOJIS: bigint;
        readonly ADD_REACTIONS: bigint;
        readonly VIEW_CHANNEL: bigint;
        readonly CONNECT: bigint;
        readonly SPEAK: bigint;
        readonly STREAM: bigint;
        readonly USE_VAD: bigint;
        readonly PRIORITY_SPEAKER: bigint;
        readonly CREATE_INSTANT_INVITE: bigint;
        readonly CHANGE_NICKNAME: bigint;
        readonly MANAGE_NICKNAMES: bigint;
        readonly VIEW_AUDIT_LOG: bigint;
        readonly VIEW_GUILD_INSIGHTS: bigint;
    };
    PERMISSION_GROUPS: {
        readonly BOT_BASE: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
        readonly MODERATION: readonly [bigint, bigint, bigint, bigint, bigint, bigint];
        readonly ADMIN: readonly [bigint, bigint, bigint, bigint, bigint, bigint];
        readonly TICKETS: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
        readonly WELCOME_LOG: readonly [bigint, bigint, bigint, bigint, bigint];
        readonly VOICE: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
    };
    COMMAND_PERMISSIONS: {
        readonly BAN: bigint;
        readonly KICK: bigint;
        readonly MUTE: bigint;
        readonly UNMUTE: bigint;
        readonly TIMEOUT: bigint;
        readonly UNTIMEOUT: bigint;
        readonly WARN: bigint;
        readonly PURGE: bigint;
        readonly LOCKDOWN: bigint;
        readonly SLOWMODE: bigint;
        readonly PROTECTION_CONFIG: bigint;
        readonly ANTIRAID_CONFIG: bigint;
        readonly ANTISPAM_CONFIG: bigint;
        readonly ANTILINK_CONFIG: bigint;
        readonly TICKET_CREATE: bigint;
        readonly TICKET_CLOSE: bigint;
        readonly TICKET_CLAIM: bigint;
        readonly TICKET_CONFIG: bigint;
        readonly SETTINGS_VIEW: bigint;
        readonly SETTINGS_EDIT: bigint;
        readonly PREFIX: bigint;
        readonly LANGUAGE: bigint;
        readonly WELCOME_CONFIG: bigint;
        readonly LOG_CONFIG: bigint;
        readonly AI_CHAT: bigint;
        readonly AI_CONFIG: bigint;
        readonly USERINFO: bigint;
        readonly SERVERINFO: bigint;
        readonly AVATAR: bigint;
        readonly BANNER: bigint;
        readonly WEATHER: bigint;
        readonly BOT_OWNER: bigint;
        readonly EVAL: bigint;
        readonly RELOAD: bigint;
        readonly SHUTDOWN: bigint;
    };
    hasPermission: typeof hasPermission;
    hasBotPermission: typeof hasBotPermission;
    hasBotPermissionInChannel: typeof hasBotPermissionInChannel;
    canModerate: typeof canModerate;
    canAssignRole: typeof canAssignRole;
    canRemoveRole: typeof canRemoveRole;
    getMissingPermissions: typeof getMissingPermissions;
    getBotMissingPermissions: typeof getBotMissingPermissions;
    getBotMissingPermissionsInChannel: typeof getBotMissingPermissionsInChannel;
    formatPermissionName: typeof formatPermissionName;
    formatPermissions: typeof formatPermissions;
    isBotOwner: typeof isBotOwner;
    isGuildOwner: typeof isGuildOwner;
    getHighestManageableRole: typeof getHighestManageableRole;
    canBotManageRole: typeof canBotManageRole;
    getCategoryPermissions: typeof getCategoryPermissions;
};
export default _default;
//# sourceMappingURL=permissions.d.ts.map