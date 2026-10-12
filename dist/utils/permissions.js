"use strict";
// ============================================
// Liberty City Bot - Permission Utilities
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMAND_PERMISSIONS = exports.PERMISSION_GROUPS = exports.PERMISSIONS = void 0;
exports.hasPermission = hasPermission;
exports.hasBotPermission = hasBotPermission;
exports.hasBotPermissionInChannel = hasBotPermissionInChannel;
exports.canModerate = canModerate;
exports.canAssignRole = canAssignRole;
exports.canRemoveRole = canRemoveRole;
exports.getMissingPermissions = getMissingPermissions;
exports.getBotMissingPermissions = getBotMissingPermissions;
exports.getBotMissingPermissionsInChannel = getBotMissingPermissionsInChannel;
exports.formatPermissionName = formatPermissionName;
exports.formatPermissions = formatPermissions;
exports.isBotOwner = isBotOwner;
exports.isGuildOwner = isGuildOwner;
exports.getHighestManageableRole = getHighestManageableRole;
exports.canBotManageRole = canBotManageRole;
exports.getCategoryPermissions = getCategoryPermissions;
const discord_js_1 = require("discord.js");
// --------------------------------------------
// Permission Constants
// --------------------------------------------
exports.PERMISSIONS = {
    // Administrative
    ADMINISTRATOR: discord_js_1.PermissionFlagsBits.Administrator,
    MANAGE_GUILD: discord_js_1.PermissionFlagsBits.ManageGuild,
    MANAGE_ROLES: discord_js_1.PermissionFlagsBits.ManageRoles,
    MANAGE_CHANNELS: discord_js_1.PermissionFlagsBits.ManageChannels,
    MANAGE_EMOJIS_AND_STICKERS: discord_js_1.PermissionFlagsBits.ManageEmojisAndStickers,
    MANAGE_WEBHOOKS: discord_js_1.PermissionFlagsBits.ManageWebhooks,
    // Moderation
    KICK_MEMBERS: discord_js_1.PermissionFlagsBits.KickMembers,
    BAN_MEMBERS: discord_js_1.PermissionFlagsBits.BanMembers,
    MODERATE_MEMBERS: discord_js_1.PermissionFlagsBits.ModerateMembers,
    MUTE_MEMBERS: discord_js_1.PermissionFlagsBits.MuteMembers,
    DEAFEN_MEMBERS: discord_js_1.PermissionFlagsBits.DeafenMembers,
    MOVE_MEMBERS: discord_js_1.PermissionFlagsBits.MoveMembers,
    // Messages
    MANAGE_MESSAGES: discord_js_1.PermissionFlagsBits.ManageMessages,
    MANAGE_THREADS: discord_js_1.PermissionFlagsBits.ManageThreads,
    SEND_MESSAGES: discord_js_1.PermissionFlagsBits.SendMessages,
    SEND_MESSAGES_IN_THREADS: discord_js_1.PermissionFlagsBits.SendMessagesInThreads,
    EMBED_LINKS: discord_js_1.PermissionFlagsBits.EmbedLinks,
    ATTACH_FILES: discord_js_1.PermissionFlagsBits.AttachFiles,
    READ_MESSAGE_HISTORY: discord_js_1.PermissionFlagsBits.ReadMessageHistory,
    MENTION_EVERYONE: discord_js_1.PermissionFlagsBits.MentionEveryone,
    USE_EXTERNAL_EMOJIS: discord_js_1.PermissionFlagsBits.UseExternalEmojis,
    ADD_REACTIONS: discord_js_1.PermissionFlagsBits.AddReactions,
    // Voice
    VIEW_CHANNEL: discord_js_1.PermissionFlagsBits.ViewChannel,
    CONNECT: discord_js_1.PermissionFlagsBits.Connect,
    SPEAK: discord_js_1.PermissionFlagsBits.Speak,
    STREAM: discord_js_1.PermissionFlagsBits.Stream,
    USE_VAD: discord_js_1.PermissionFlagsBits.UseVAD,
    PRIORITY_SPEAKER: discord_js_1.PermissionFlagsBits.PrioritySpeaker,
    // Other
    CREATE_INSTANT_INVITE: discord_js_1.PermissionFlagsBits.CreateInstantInvite,
    CHANGE_NICKNAME: discord_js_1.PermissionFlagsBits.ChangeNickname,
    MANAGE_NICKNAMES: discord_js_1.PermissionFlagsBits.ManageNicknames,
    VIEW_AUDIT_LOG: discord_js_1.PermissionFlagsBits.ViewAuditLog,
    VIEW_GUILD_INSIGHTS: discord_js_1.PermissionFlagsBits.ViewGuildInsights,
};
// --------------------------------------------
// Permission Groups
// --------------------------------------------
exports.PERMISSION_GROUPS = {
    // Basic bot permissions needed for core functionality
    BOT_BASE: [
        discord_js_1.PermissionFlagsBits.ViewChannel,
        discord_js_1.PermissionFlagsBits.SendMessages,
        discord_js_1.PermissionFlagsBits.EmbedLinks,
        discord_js_1.PermissionFlagsBits.AttachFiles,
        discord_js_1.PermissionFlagsBits.ReadMessageHistory,
        discord_js_1.PermissionFlagsBits.AddReactions,
        discord_js_1.PermissionFlagsBits.UseExternalEmojis,
        discord_js_1.PermissionFlagsBits.ManageMessages,
        discord_js_1.PermissionFlagsBits.ManageThreads,
    ],
    // Moderation permissions
    MODERATION: [
        discord_js_1.PermissionFlagsBits.KickMembers,
        discord_js_1.PermissionFlagsBits.BanMembers,
        discord_js_1.PermissionFlagsBits.ModerateMembers,
        discord_js_1.PermissionFlagsBits.ManageMessages,
        discord_js_1.PermissionFlagsBits.ManageNicknames,
        discord_js_1.PermissionFlagsBits.ViewAuditLog,
    ],
    // Admin permissions
    ADMIN: [
        discord_js_1.PermissionFlagsBits.Administrator,
        discord_js_1.PermissionFlagsBits.ManageGuild,
        discord_js_1.PermissionFlagsBits.ManageRoles,
        discord_js_1.PermissionFlagsBits.ManageChannels,
        discord_js_1.PermissionFlagsBits.ManageWebhooks,
        discord_js_1.PermissionFlagsBits.ManageEmojisAndStickers,
    ],
    // Ticket system permissions
    TICKETS: [
        discord_js_1.PermissionFlagsBits.ViewChannel,
        discord_js_1.PermissionFlagsBits.SendMessages,
        discord_js_1.PermissionFlagsBits.EmbedLinks,
        discord_js_1.PermissionFlagsBits.AttachFiles,
        discord_js_1.PermissionFlagsBits.ReadMessageHistory,
        discord_js_1.PermissionFlagsBits.AddReactions,
        discord_js_1.PermissionFlagsBits.ManageMessages,
        discord_js_1.PermissionFlagsBits.ManageThreads,
        discord_js_1.PermissionFlagsBits.ManageChannels,
    ],
    // Welcome/Logging permissions
    WELCOME_LOG: [
        discord_js_1.PermissionFlagsBits.ViewChannel,
        discord_js_1.PermissionFlagsBits.SendMessages,
        discord_js_1.PermissionFlagsBits.EmbedLinks,
        discord_js_1.PermissionFlagsBits.AttachFiles,
        discord_js_1.PermissionFlagsBits.ReadMessageHistory,
    ],
    // Voice permissions
    VOICE: [
        discord_js_1.PermissionFlagsBits.ViewChannel,
        discord_js_1.PermissionFlagsBits.Connect,
        discord_js_1.PermissionFlagsBits.Speak,
        discord_js_1.PermissionFlagsBits.Stream,
        discord_js_1.PermissionFlagsBits.UseVAD,
        discord_js_1.PermissionFlagsBits.PrioritySpeaker,
        discord_js_1.PermissionFlagsBits.MuteMembers,
        discord_js_1.PermissionFlagsBits.DeafenMembers,
        discord_js_1.PermissionFlagsBits.MoveMembers,
    ],
};
// --------------------------------------------
// Permission Check Functions
// --------------------------------------------
/**
 * Check if a member has a specific permission or any of the permissions in an array
 */
function hasPermission(member, permissions, checkAdmin = true) {
    if (checkAdmin && member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
        return true;
    }
    if (Array.isArray(permissions)) {
        return permissions.some(p => member.permissions.has(p));
    }
    return member.permissions.has(permissions);
}
/**
 * Check if the bot has a specific permission in a guild
 */
function hasBotPermission(guild, permissions) {
    const me = guild.members.me;
    if (!me)
        return false;
    if (Array.isArray(permissions)) {
        return permissions.some(p => me.permissions.has(p));
    }
    return me.permissions.has(permissions);
}
/**
 * Check if the bot has a specific permission in a channel
 */
function hasBotPermissionInChannel(channel, permissions) {
    const me = channel.guild.members.me;
    if (!me)
        return false;
    const channelPerms = channel.permissionsFor(me);
    if (!channelPerms)
        return false;
    if (Array.isArray(permissions)) {
        return permissions.some(p => channelPerms.has(p));
    }
    return channelPerms.has(permissions);
}
/**
 * Check if a member can moderate another member
 */
function canModerate(moderator, target) {
    // Can't moderate yourself
    if (moderator.id === target.id)
        return false;
    // Guild owner can moderate everyone
    if (moderator.id === moderator.guild.ownerId)
        return true;
    // Can't moderate the guild owner
    if (target.id === target.guild.ownerId)
        return false;
    // Check role hierarchy
    return moderator.roles.highest.position > target.roles.highest.position;
}
/**
 * Check if a member can assign a role to another member
 */
function canAssignRole(moderator, target, role) {
    if (moderator.id === target.id)
        return false;
    if (moderator.id === moderator.guild.ownerId)
        return true;
    if (target.id === target.guild.ownerId)
        return false;
    // The moderator's highest role must be higher than the role being assigned
    if (moderator.roles.highest.position <= role.position)
        return false;
    // The moderator's highest role must be higher than target's highest role
    return moderator.roles.highest.position > target.roles.highest.position;
}
/**
 * Check if a member can remove a role from another member
 */
function canRemoveRole(moderator, target, role) {
    return canAssignRole(moderator, target, role);
}
/**
 * Get missing permissions for a member
 */
function getMissingPermissions(member, permissions) {
    return permissions.filter(p => !member.permissions.has(p));
}
/**
 * Get missing permissions for the bot in a guild
 */
function getBotMissingPermissions(guild, permissions) {
    const me = guild.members.me;
    if (!me)
        return permissions;
    return permissions.filter(p => !me.permissions.has(p));
}
/**
 * Get missing permissions for the bot in a channel
 */
function getBotMissingPermissionsInChannel(channel, permissions) {
    const me = channel.guild.members.me;
    if (!me)
        return permissions;
    const channelPerms = channel.permissionsFor(me);
    if (!channelPerms)
        return permissions;
    return permissions.filter(p => !channelPerms.has(p));
}
/**
 * Format permission names for display (Arabic)
 */
function formatPermissionName(permission) {
    const names = {
        [discord_js_1.PermissionFlagsBits.Administrator.toString()]: 'مدير السيرفر',
        [discord_js_1.PermissionFlagsBits.ManageGuild.toString()]: 'إدارة السيرفر',
        [discord_js_1.PermissionFlagsBits.ManageRoles.toString()]: 'إدارة الأدوار',
        [discord_js_1.PermissionFlagsBits.ManageChannels.toString()]: 'إدارة القنوات',
        [discord_js_1.PermissionFlagsBits.KickMembers.toString()]: 'طرد الأعضاء',
        [discord_js_1.PermissionFlagsBits.BanMembers.toString()]: 'حظر الأعضاء',
        [discord_js_1.PermissionFlagsBits.ModerateMembers.toString()]: 'إدارة الأعضاء (Timeout)',
        [discord_js_1.PermissionFlagsBits.ManageMessages.toString()]: 'إدارة الرسائل',
        [discord_js_1.PermissionFlagsBits.ManageNicknames.toString()]: 'إدارة الألقاب',
        [discord_js_1.PermissionFlagsBits.ViewAuditLog.toString()]: 'عرض سجل التدقيق',
        [discord_js_1.PermissionFlagsBits.ViewChannel.toString()]: 'عرض القنوات',
        [discord_js_1.PermissionFlagsBits.SendMessages.toString()]: 'إرسال رسائل',
        [discord_js_1.PermissionFlagsBits.EmbedLinks.toString()]: 'إرسال روابط مضمنة',
        [discord_js_1.PermissionFlagsBits.AttachFiles.toString()]: 'إرفاق ملفات',
        [discord_js_1.PermissionFlagsBits.ReadMessageHistory.toString()]: 'قراءة سجل الرسائل',
        [discord_js_1.PermissionFlagsBits.MentionEveryone.toString()]: 'منشن everyone/here',
        [discord_js_1.PermissionFlagsBits.UseExternalEmojis.toString()]: 'استخدام إيموجيز خارجية',
        [discord_js_1.PermissionFlagsBits.AddReactions.toString()]: 'إضافة تفاعلات',
        [discord_js_1.PermissionFlagsBits.Connect.toString()]: 'الاتصال بالصوت',
        [discord_js_1.PermissionFlagsBits.Speak.toString()]: 'التحدث',
        [discord_js_1.PermissionFlagsBits.Stream.toString()]: 'البث',
        [discord_js_1.PermissionFlagsBits.MuteMembers.toString()]: 'كتم الأعضاء',
        [discord_js_1.PermissionFlagsBits.DeafenMembers.toString()]: 'إصمات الأعضاء',
        [discord_js_1.PermissionFlagsBits.MoveMembers.toString()]: 'نقل الأعضاء',
        [discord_js_1.PermissionFlagsBits.CreateInstantInvite.toString()]: 'إنشاء دعوات',
        [discord_js_1.PermissionFlagsBits.ChangeNickname.toString()]: 'تغيير اللقب',
        [discord_js_1.PermissionFlagsBits.ManageWebhooks.toString()]: 'إدارة الويب هوكس',
        [discord_js_1.PermissionFlagsBits.ManageEmojisAndStickers.toString()]: 'إدارة الإيموجيز والملصقات',
        [discord_js_1.PermissionFlagsBits.ManageThreads.toString()]: 'إدارة الثريدات',
        [discord_js_1.PermissionFlagsBits.SendMessagesInThreads.toString()]: 'إرسال رسائل في الثريدات',
        [discord_js_1.PermissionFlagsBits.UseVAD.toString()]: 'استخدام كشف الصوت',
        [discord_js_1.PermissionFlagsBits.PrioritySpeaker.toString()]: 'متحدث أولوية',
        [discord_js_1.PermissionFlagsBits.ViewGuildInsights.toString()]: 'عرض إحصائيات السيرفر',
    };
    return names[permission.toString()] || `غير معروف (${permission})`;
}
/**
 * Format multiple permissions for display
 */
function formatPermissions(permissions) {
    return permissions.map(formatPermissionName).join('، ');
}
/**
 * Check if user is bot owner
 */
function isBotOwner(userId, ownerId) {
    return userId === ownerId;
}
/**
 * Check if user is guild owner
 */
function isGuildOwner(member) {
    return member.id === member.guild.ownerId;
}
/**
 * Get the highest role a member can manage
 */
function getHighestManageableRole(member) {
    const botHighest = member.guild.members.me?.roles.highest;
    if (!botHighest)
        return null;
    const manageableRoles = member.roles.cache.filter(r => r.position < botHighest.position &&
        r.id !== member.guild.id // @everyone role
    );
    if (manageableRoles.size === 0)
        return null;
    return manageableRoles.reduce((highest, role) => role.position > highest.position ? role : highest);
}
/**
 * Check if bot can manage a role
 */
function canBotManageRole(guild, role) {
    const me = guild.members.me;
    if (!me)
        return false;
    return me.roles.highest.position > role.position && role.id !== guild.id;
}
/**
 * Permission flags for slash command default member permissions
 */
exports.COMMAND_PERMISSIONS = {
    // Moderation commands
    BAN: discord_js_1.PermissionFlagsBits.BanMembers,
    KICK: discord_js_1.PermissionFlagsBits.KickMembers,
    MUTE: discord_js_1.PermissionFlagsBits.ModerateMembers,
    UNMUTE: discord_js_1.PermissionFlagsBits.ModerateMembers,
    TIMEOUT: discord_js_1.PermissionFlagsBits.ModerateMembers,
    UNTIMEOUT: discord_js_1.PermissionFlagsBits.ModerateMembers,
    WARN: discord_js_1.PermissionFlagsBits.ModerateMembers,
    PURGE: discord_js_1.PermissionFlagsBits.ManageMessages,
    LOCKDOWN: discord_js_1.PermissionFlagsBits.ManageChannels,
    SLOWMODE: discord_js_1.PermissionFlagsBits.ManageChannels,
    // Protection commands
    PROTECTION_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    ANTIRAID_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    ANTISPAM_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    ANTILINK_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    // Ticket commands
    TICKET_CREATE: discord_js_1.PermissionFlagsBits.SendMessages,
    TICKET_CLOSE: discord_js_1.PermissionFlagsBits.ManageChannels,
    TICKET_CLAIM: discord_js_1.PermissionFlagsBits.ManageChannels,
    TICKET_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    // Settings commands
    SETTINGS_VIEW: discord_js_1.PermissionFlagsBits.ManageGuild,
    SETTINGS_EDIT: discord_js_1.PermissionFlagsBits.ManageGuild,
    PREFIX: discord_js_1.PermissionFlagsBits.ManageGuild,
    LANGUAGE: discord_js_1.PermissionFlagsBits.ManageGuild,
    WELCOME_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    LOG_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    // AI commands
    AI_CHAT: discord_js_1.PermissionFlagsBits.SendMessages,
    AI_CONFIG: discord_js_1.PermissionFlagsBits.ManageGuild,
    // Utility commands
    USERINFO: discord_js_1.PermissionFlagsBits.SendMessages,
    SERVERINFO: discord_js_1.PermissionFlagsBits.SendMessages,
    AVATAR: discord_js_1.PermissionFlagsBits.SendMessages,
    BANNER: discord_js_1.PermissionFlagsBits.SendMessages,
    WEATHER: discord_js_1.PermissionFlagsBits.SendMessages,
    // Admin/Owner only
    BOT_OWNER: discord_js_1.PermissionFlagsBits.Administrator, // Will be checked separately
    EVAL: discord_js_1.PermissionFlagsBits.Administrator,
    RELOAD: discord_js_1.PermissionFlagsBits.Administrator,
    SHUTDOWN: discord_js_1.PermissionFlagsBits.Administrator,
};
/**
 * Get required permissions for a command category
 */
function getCategoryPermissions(category) {
    const categoryPermissions = {
        moderation: [
            discord_js_1.PermissionFlagsBits.KickMembers,
            discord_js_1.PermissionFlagsBits.BanMembers,
            discord_js_1.PermissionFlagsBits.ModerateMembers,
            discord_js_1.PermissionFlagsBits.ManageMessages,
            discord_js_1.PermissionFlagsBits.ManageNicknames,
        ],
        protection: [
            discord_js_1.PermissionFlagsBits.ManageGuild,
        ],
        tickets: [
            discord_js_1.PermissionFlagsBits.ManageChannels,
            discord_js_1.PermissionFlagsBits.ManageMessages,
        ],
        settings: [
            discord_js_1.PermissionFlagsBits.ManageGuild,
        ],
        ai: [],
        utility: [],
        info: [],
    };
    return categoryPermissions[category] || [];
}
exports.default = {
    PERMISSIONS: exports.PERMISSIONS,
    PERMISSION_GROUPS: exports.PERMISSION_GROUPS,
    COMMAND_PERMISSIONS: exports.COMMAND_PERMISSIONS,
    hasPermission,
    hasBotPermission,
    hasBotPermissionInChannel,
    canModerate,
    canAssignRole,
    canRemoveRole,
    getMissingPermissions,
    getBotMissingPermissions,
    getBotMissingPermissionsInChannel,
    formatPermissionName,
    formatPermissions,
    isBotOwner,
    isGuildOwner,
    getHighestManageableRole,
    canBotManageRole,
    getCategoryPermissions,
};
//# sourceMappingURL=permissions.js.map