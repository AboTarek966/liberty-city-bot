// ============================================
// Liberty City Bot - Permission Utilities
// ============================================

import { 
  PermissionsBitField, 
  PermissionFlagsBits, 
  GuildMember, 
  Guild, 
  TextChannel, 
  Role 
} from 'discord.js';

// --------------------------------------------
// Permission Constants
// --------------------------------------------
export const PERMISSIONS = {
  // Administrative
  ADMINISTRATOR: PermissionFlagsBits.Administrator,
  MANAGE_GUILD: PermissionFlagsBits.ManageGuild,
  MANAGE_ROLES: PermissionFlagsBits.ManageRoles,
  MANAGE_CHANNELS: PermissionFlagsBits.ManageChannels,
  MANAGE_EMOJIS_AND_STICKERS: PermissionFlagsBits.ManageEmojisAndStickers,
  MANAGE_WEBHOOKS: PermissionFlagsBits.ManageWebhooks,
  
  // Moderation
  KICK_MEMBERS: PermissionFlagsBits.KickMembers,
  BAN_MEMBERS: PermissionFlagsBits.BanMembers,
  MODERATE_MEMBERS: PermissionFlagsBits.ModerateMembers,
  MUTE_MEMBERS: PermissionFlagsBits.MuteMembers,
  DEAFEN_MEMBERS: PermissionFlagsBits.DeafenMembers,
  MOVE_MEMBERS: PermissionFlagsBits.MoveMembers,
  
  // Messages
  MANAGE_MESSAGES: PermissionFlagsBits.ManageMessages,
  MANAGE_THREADS: PermissionFlagsBits.ManageThreads,
  SEND_MESSAGES: PermissionFlagsBits.SendMessages,
  SEND_MESSAGES_IN_THREADS: PermissionFlagsBits.SendMessagesInThreads,
  EMBED_LINKS: PermissionFlagsBits.EmbedLinks,
  ATTACH_FILES: PermissionFlagsBits.AttachFiles,
  READ_MESSAGE_HISTORY: PermissionFlagsBits.ReadMessageHistory,
  MENTION_EVERYONE: PermissionFlagsBits.MentionEveryone,
  USE_EXTERNAL_EMOJIS: PermissionFlagsBits.UseExternalEmojis,
  ADD_REACTIONS: PermissionFlagsBits.AddReactions,
  
  // Voice
  VIEW_CHANNEL: PermissionFlagsBits.ViewChannel,
  CONNECT: PermissionFlagsBits.Connect,
  SPEAK: PermissionFlagsBits.Speak,
  STREAM: PermissionFlagsBits.Stream,
  USE_VAD: PermissionFlagsBits.UseVAD,
  PRIORITY_SPEAKER: PermissionFlagsBits.PrioritySpeaker,
  
  // Other
  CREATE_INSTANT_INVITE: PermissionFlagsBits.CreateInstantInvite,
  CHANGE_NICKNAME: PermissionFlagsBits.ChangeNickname,
  MANAGE_NICKNAMES: PermissionFlagsBits.ManageNicknames,
  VIEW_AUDIT_LOG: PermissionFlagsBits.ViewAuditLog,
  VIEW_GUILD_INSIGHTS: PermissionFlagsBits.ViewGuildInsights,
} as const;

// --------------------------------------------
// Permission Groups
// --------------------------------------------
export const PERMISSION_GROUPS = {
  // Basic bot permissions needed for core functionality
  BOT_BASE: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.UseExternalEmojis,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageThreads,
  ],
  
  // Moderation permissions
  MODERATION: [
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ViewAuditLog,
  ],
  
  // Admin permissions
  ADMIN: [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.ManageEmojisAndStickers,
  ],
  
  // Ticket system permissions
  TICKETS: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageThreads,
    PermissionFlagsBits.ManageChannels,
  ],
  
  // Welcome/Logging permissions
  WELCOME_LOG: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
  ],
  
  // Voice permissions
  VOICE: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
    PermissionFlagsBits.Stream,
    PermissionFlagsBits.UseVAD,
    PermissionFlagsBits.PrioritySpeaker,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.DeafenMembers,
    PermissionFlagsBits.MoveMembers,
  ],
} as const;

// --------------------------------------------
// Permission Check Functions
// --------------------------------------------

/**
 * Check if a member has a specific permission or any of the permissions in an array
 */
export function hasPermission(
  member: GuildMember, 
  permissions: bigint | bigint[], 
  checkAdmin = true
): boolean {
  if (checkAdmin && member.permissions.has(PermissionFlagsBits.Administrator)) {
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
export function hasBotPermission(
  guild: Guild, 
  permissions: bigint | bigint[]
): boolean {
  const me = guild.members.me;
  if (!me) return false;
  
  if (Array.isArray(permissions)) {
    return permissions.some(p => me.permissions.has(p));
  }
  
  return me.permissions.has(permissions);
}

/**
 * Check if the bot has a specific permission in a channel
 */
export function hasBotPermissionInChannel(
  channel: TextChannel, 
  permissions: bigint | bigint[]
): boolean {
  const me = channel.guild.members.me;
  if (!me) return false;
  
  const channelPerms = channel.permissionsFor(me);
  if (!channelPerms) return false;
  
  if (Array.isArray(permissions)) {
    return permissions.some(p => channelPerms.has(p));
  }
  
  return channelPerms.has(permissions);
}

/**
 * Check if a member can moderate another member
 */
export function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  // Can't moderate yourself
  if (moderator.id === target.id) return false;
  
  // Guild owner can moderate everyone
  if (moderator.id === moderator.guild.ownerId) return true;
  
  // Can't moderate the guild owner
  if (target.id === target.guild.ownerId) return false;
  
  // Check role hierarchy
  return moderator.roles.highest.position > target.roles.highest.position;
}

/**
 * Check if a member can assign a role to another member
 */
export function canAssignRole(moderator: GuildMember, target: GuildMember, role: Role): boolean {
  if (moderator.id === target.id) return false;
  if (moderator.id === moderator.guild.ownerId) return true;
  if (target.id === target.guild.ownerId) return false;
  
  // The moderator's highest role must be higher than the role being assigned
  if (moderator.roles.highest.position <= role.position) return false;
  
  // The moderator's highest role must be higher than target's highest role
  return moderator.roles.highest.position > target.roles.highest.position;
}

/**
 * Check if a member can remove a role from another member
 */
export function canRemoveRole(moderator: GuildMember, target: GuildMember, role: Role): boolean {
  return canAssignRole(moderator, target, role);
}

/**
 * Get missing permissions for a member
 */
export function getMissingPermissions(
  member: GuildMember, 
  permissions: bigint[]
): bigint[] {
  return permissions.filter(p => !member.permissions.has(p));
}

/**
 * Get missing permissions for the bot in a guild
 */
export function getBotMissingPermissions(
  guild: Guild, 
  permissions: bigint[]
): bigint[] {
  const me = guild.members.me;
  if (!me) return permissions;
  
  return permissions.filter(p => !me.permissions.has(p));
}

/**
 * Get missing permissions for the bot in a channel
 */
export function getBotMissingPermissionsInChannel(
  channel: TextChannel, 
  permissions: bigint[]
): bigint[] {
  const me = channel.guild.members.me;
  if (!me) return permissions;
  
  const channelPerms = channel.permissionsFor(me);
  if (!channelPerms) return permissions;
  
  return permissions.filter(p => !channelPerms.has(p));
}

/**
 * Format permission names for display (Arabic)
 */
export function formatPermissionName(permission: bigint): string {
  const names: Record<string, string> = {
    [PermissionFlagsBits.Administrator.toString()]: 'مدير السيرفر',
    [PermissionFlagsBits.ManageGuild.toString()]: 'إدارة السيرفر',
    [PermissionFlagsBits.ManageRoles.toString()]: 'إدارة الأدوار',
    [PermissionFlagsBits.ManageChannels.toString()]: 'إدارة القنوات',
    [PermissionFlagsBits.KickMembers.toString()]: 'طرد الأعضاء',
    [PermissionFlagsBits.BanMembers.toString()]: 'حظر الأعضاء',
    [PermissionFlagsBits.ModerateMembers.toString()]: 'إدارة الأعضاء (Timeout)',
    [PermissionFlagsBits.ManageMessages.toString()]: 'إدارة الرسائل',
    [PermissionFlagsBits.ManageNicknames.toString()]: 'إدارة الألقاب',
    [PermissionFlagsBits.ViewAuditLog.toString()]: 'عرض سجل التدقيق',
    [PermissionFlagsBits.ViewChannel.toString()]: 'عرض القنوات',
    [PermissionFlagsBits.SendMessages.toString()]: 'إرسال رسائل',
    [PermissionFlagsBits.EmbedLinks.toString()]: 'إرسال روابط مضمنة',
    [PermissionFlagsBits.AttachFiles.toString()]: 'إرفاق ملفات',
    [PermissionFlagsBits.ReadMessageHistory.toString()]: 'قراءة سجل الرسائل',
    [PermissionFlagsBits.MentionEveryone.toString()]: 'منشن everyone/here',
    [PermissionFlagsBits.UseExternalEmojis.toString()]: 'استخدام إيموجيز خارجية',
    [PermissionFlagsBits.AddReactions.toString()]: 'إضافة تفاعلات',
    [PermissionFlagsBits.Connect.toString()]: 'الاتصال بالصوت',
    [PermissionFlagsBits.Speak.toString()]: 'التحدث',
    [PermissionFlagsBits.Stream.toString()]: 'البث',
    [PermissionFlagsBits.MuteMembers.toString()]: 'كتم الأعضاء',
    [PermissionFlagsBits.DeafenMembers.toString()]: 'إصمات الأعضاء',
    [PermissionFlagsBits.MoveMembers.toString()]: 'نقل الأعضاء',
    [PermissionFlagsBits.CreateInstantInvite.toString()]: 'إنشاء دعوات',
    [PermissionFlagsBits.ChangeNickname.toString()]: 'تغيير اللقب',
    [PermissionFlagsBits.ManageWebhooks.toString()]: 'إدارة الويب هوكس',
    [PermissionFlagsBits.ManageEmojisAndStickers.toString()]: 'إدارة الإيموجيز والملصقات',
    [PermissionFlagsBits.ManageThreads.toString()]: 'إدارة الثريدات',
    [PermissionFlagsBits.SendMessagesInThreads.toString()]: 'إرسال رسائل في الثريدات',
    [PermissionFlagsBits.UseVAD.toString()]: 'استخدام كشف الصوت',
    [PermissionFlagsBits.PrioritySpeaker.toString()]: 'متحدث أولوية',
    [PermissionFlagsBits.ViewGuildInsights.toString()]: 'عرض إحصائيات السيرفر',
  };
  
  return names[permission.toString()] || `غير معروف (${permission})`;
}

/**
 * Format multiple permissions for display
 */
export function formatPermissions(permissions: bigint[]): string {
  return permissions.map(formatPermissionName).join('، ');
}

/**
 * Check if user is bot owner
 */
export function isBotOwner(userId: string, ownerId: string): boolean {
  return userId === ownerId;
}

/**
 * Check if user is guild owner
 */
export function isGuildOwner(member: GuildMember): boolean {
  return member.id === member.guild.ownerId;
}

/**
 * Get the highest role a member can manage
 */
export function getHighestManageableRole(member: GuildMember): Role | null {
  const botHighest = member.guild.members.me?.roles.highest;
  if (!botHighest) return null;
  
  const manageableRoles = member.roles.cache.filter(r => 
    r.position < botHighest.position && 
    r.id !== member.guild.id // @everyone role
  );
  
  if (manageableRoles.size === 0) return null;
  
  return manageableRoles.reduce<Role>((highest, role) => 
    role.position > highest.position ? role : highest
  );
}

/**
 * Check if bot can manage a role
 */
export function canBotManageRole(guild: Guild, role: Role): boolean {
  const me = guild.members.me;
  if (!me) return false;
  
  return me.roles.highest.position > role.position && role.id !== guild.id;
}

/**
 * Permission flags for slash command default member permissions
 */
export const COMMAND_PERMISSIONS = {
  // Moderation commands
  BAN: PermissionFlagsBits.BanMembers,
  KICK: PermissionFlagsBits.KickMembers,
  MUTE: PermissionFlagsBits.ModerateMembers,
  UNMUTE: PermissionFlagsBits.ModerateMembers,
  TIMEOUT: PermissionFlagsBits.ModerateMembers,
  UNTIMEOUT: PermissionFlagsBits.ModerateMembers,
  WARN: PermissionFlagsBits.ModerateMembers,
  PURGE: PermissionFlagsBits.ManageMessages,
  LOCKDOWN: PermissionFlagsBits.ManageChannels,
  SLOWMODE: PermissionFlagsBits.ManageChannels,
  
  // Protection commands
  PROTECTION_CONFIG: PermissionFlagsBits.ManageGuild,
  ANTIRAID_CONFIG: PermissionFlagsBits.ManageGuild,
  ANTISPAM_CONFIG: PermissionFlagsBits.ManageGuild,
  ANTILINK_CONFIG: PermissionFlagsBits.ManageGuild,
  
  // Ticket commands
  TICKET_CREATE: PermissionFlagsBits.SendMessages,
  TICKET_CLOSE: PermissionFlagsBits.ManageChannels,
  TICKET_CLAIM: PermissionFlagsBits.ManageChannels,
  TICKET_CONFIG: PermissionFlagsBits.ManageGuild,
  
  // Settings commands
  SETTINGS_VIEW: PermissionFlagsBits.ManageGuild,
  SETTINGS_EDIT: PermissionFlagsBits.ManageGuild,
  PREFIX: PermissionFlagsBits.ManageGuild,
  LANGUAGE: PermissionFlagsBits.ManageGuild,
  WELCOME_CONFIG: PermissionFlagsBits.ManageGuild,
  LOG_CONFIG: PermissionFlagsBits.ManageGuild,
  
  // AI commands
  AI_CHAT: PermissionFlagsBits.SendMessages,
  AI_CONFIG: PermissionFlagsBits.ManageGuild,
  
  // Utility commands
  USERINFO: PermissionFlagsBits.SendMessages,
  SERVERINFO: PermissionFlagsBits.SendMessages,
  AVATAR: PermissionFlagsBits.SendMessages,
  BANNER: PermissionFlagsBits.SendMessages,
  WEATHER: PermissionFlagsBits.SendMessages,
  
  // Admin/Owner only
  BOT_OWNER: PermissionFlagsBits.Administrator, // Will be checked separately
  EVAL: PermissionFlagsBits.Administrator,
  RELOAD: PermissionFlagsBits.Administrator,
  SHUTDOWN: PermissionFlagsBits.Administrator,
} as const;

/**
 * Get required permissions for a command category
 */
export function getCategoryPermissions(category: string): bigint[] {
  const categoryPermissions: Record<string, bigint[]> = {
    moderation: [
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageNicknames,
    ],
    protection: [
      PermissionFlagsBits.ManageGuild,
    ],
    tickets: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
    ],
    settings: [
      PermissionFlagsBits.ManageGuild,
    ],
    ai: [],
    utility: [],
    info: [],
  };
  
  return categoryPermissions[category] || [];
}

export default {
  PERMISSIONS,
  PERMISSION_GROUPS,
  COMMAND_PERMISSIONS,
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