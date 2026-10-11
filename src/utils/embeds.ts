// ============================================
// Liberty City Bot - Embed Utilities
// ============================================

import { EmbedBuilder, Colors as DiscordColors, Guild, User, GuildMember, TextChannel, ColorResolvable } from 'discord.js';
import { config } from '../config';
import moment from 'moment';
import 'moment-duration-format';

// --------------------------------------------
// Color Helpers
// --------------------------------------------
export const Colors: Record<string, ColorResolvable> = {
  primary: config.discord.colors.primary as ColorResolvable,
  success: config.discord.colors.success as ColorResolvable,
  warning: config.discord.colors.warning as ColorResolvable,
  error: config.discord.colors.error as ColorResolvable,
  info: config.discord.colors.info as ColorResolvable,
  // Discord.js colors (numeric values)
  ...DiscordColors,
};

// --------------------------------------------
// Base Embed Creator
// --------------------------------------------
export function createEmbed(options: {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string; iconURL?: string };
  thumbnail?: string;
  image?: string;
  author?: { name: string; iconURL?: string; url?: string };
  timestamp?: boolean;
  url?: string;
}): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.color) embed.setColor(options.color as ColorResolvable);
  if (options.fields) embed.addFields(options.fields);
  if (options.footer) embed.setFooter(options.footer);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);
  if (options.author) embed.setAuthor(options.author);
  if (options.timestamp !== false) embed.setTimestamp();
  if (options.url) embed.setURL(options.url);

  return embed;
}

// --------------------------------------------
// Predefined Embed Types
// --------------------------------------------
export function successEmbed(title: string, description: string, footer?: string): EmbedBuilder {
  return createEmbed({
    title: `✅ ${title}`,
    description,
    color: Colors.success,
    footer: footer ? { text: footer } : undefined,
  });
}

export function errorEmbed(title: string, description: string, footer?: string): EmbedBuilder {
  return createEmbed({
    title: `❌ ${title}`,
    description,
    color: Colors.error,
    footer: footer ? { text: footer } : undefined,
  });
}

export function warningEmbed(title: string, description: string, footer?: string): EmbedBuilder {
  return createEmbed({
    title: `⚠️ ${title}`,
    description,
    color: Colors.warning,
    footer: footer ? { text: footer } : undefined,
  });
}

export function infoEmbed(title: string, description: string, footer?: string): EmbedBuilder {
  return createEmbed({
    title: `ℹ️ ${title}`,
    description,
    color: Colors.info,
    footer: footer ? { text: footer } : undefined,
  });
}

export function primaryEmbed(title: string, description: string, footer?: string): EmbedBuilder {
  return createEmbed({
    title,
    description,
    color: Colors.primary,
    footer: footer ? { text: footer } : undefined,
  });
}

// --------------------------------------------
// Moderation Embeds
// --------------------------------------------
export function moderationEmbed(data: {
  type: 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unwarn' | 'timeout' | 'untimeout' | 'softban' | 'note' | 'role_add' | 'role_remove';
  moderator: User | GuildMember;
  target: User | GuildMember;
  reason: string;
  caseId: number;
  duration?: string;
  proof?: string;
  extraFields?: { name: string; value: string; inline?: boolean }[];
}): EmbedBuilder {
  const typeEmojis: Record<string, string> = {
    ban: '🔨',
    kick: '👢',
    mute: '🔇',
    unmute: '🔊',
    warn: '⚠️',
    unwarn: '✅',
    timeout: '⏱️',
    untimeout: '▶️',
    softban: '🔨',
    note: '📝',
    role_add: '➕',
    role_remove: '➖',
  };

  const typeNames: Record<string, string> = {
    ban: 'حظر',
    kick: 'طرد',
    mute: 'كتم',
    unmute: 'إلغاء كتم',
    warn: 'تحذير',
    unwarn: 'إزالة تحذير',
    timeout: 'مهلة زمنية',
    untimeout: 'إلغاء مهلة',
    softban: 'حظر ناعم',
    note: 'ملاحظة',
    role_add: 'إضافة رول',
    role_remove: 'إزالة رول',
  };

  const embed = createEmbed({
    title: `${typeEmojis[data.type]} ${typeNames[data.type]}`,
    color: (data.type === 'ban' || data.type === 'kick' ? Colors.error :
           data.type === 'mute' || data.type === 'timeout' || data.type === 'role_remove' ? Colors.warning :
           data.type === 'warn' ? Colors.warning : Colors.success) as ColorResolvable,
    fields: [
      { name: '👤 العضو', value: `${data.target} (\`${data.target.id}\`)`, inline: true },
      { name: '🛡️ المنفذ', value: `${data.moderator} (\`${data.moderator.id}\`)`, inline: true },
      { name: '📋 السبب', value: data.reason, inline: false },
      { name: '🔢 رقم القضية', value: `#${data.caseId}`, inline: true },
    ],
    footer: { text: `Liberty City | ${moment().format('YYYY/MM/DD HH:mm:ss')}` },
    timestamp: true,
  });

  if (data.duration) {
    embed.addFields({ name: '⏱️ المدة', value: data.duration, inline: true });
  }

  if (data.proof) {
    embed.addFields({ name: '📸 الدليل', value: data.proof, inline: false });
  }

  if (data.extraFields?.length) {
    embed.addFields(...data.extraFields);
  }

  return embed;
}

// --------------------------------------------
// Ticket Embeds
// --------------------------------------------
export function ticketEmbed(data: {
  title: string;
  description: string;
  user: User;
  type: string;
  status: 'open' | 'claimed' | 'waiting' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  claimedBy?: User;
  fields?: Array<{ question: string; answer: string }>;
}): EmbedBuilder {
  const statusEmojis = {
    open: '🟢',
    claimed: '🔵',
    waiting: '🟡',
    closed: '🔴',
  };

  const priorityColors = {
    low: Colors.success,
    medium: Colors.info,
    high: Colors.warning,
    urgent: Colors.error,
  };

  const priorityNames = {
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    urgent: 'عاجلة',
  };

  const embed = createEmbed({
    title: `${statusEmojis[data.status]} ${data.title}`,
    description: data.description,
    color: priorityColors[data.priority],
    fields: [
      { name: '👤 مقدم التذكرة', value: `${data.user} (\`${data.user.id}\`)`, inline: true },
      { name: '📂 النوع', value: data.type, inline: true },
      { name: '🎯 الأولوية', value: priorityNames[data.priority], inline: true },
    ],
    footer: { text: 'Liberty City Tickets' },
    timestamp: true,
  });

  if (data.claimedBy) {
    embed.addFields({ name: '🛡️ تم الاستلام من قبل', value: `${data.claimedBy}`, inline: true });
  }

  if (data.fields && data.fields.length > 0) {
    data.fields.forEach(field => {
      embed.addFields({ name: field.question, value: field.answer || 'غير مجاب', inline: false });
    });
  }

  return embed;
}

export function ticketTranscriptEmbed(data: {
  ticketId: string;
  user: User;
  type: string;
  status: string;
  messages: Array<{ author: User; content: string; timestamp: Date }>;
  closedBy?: User;
  closeReason?: string;
}): EmbedBuilder {
  const embed = createEmbed({
    title: `📜 نسخة التذكرة #${data.ticketId}`,
    color: Colors.info,
    fields: [
      { name: '👤 العضو', value: `${data.user} (\`${data.user.id}\`)`, inline: true },
      { name: '📂 النوع', value: data.type, inline: true },
      { name: '📊 الحالة', value: data.status, inline: true },
    ],
    footer: { text: `Liberty City | ${moment().format('YYYY/MM/DD HH:mm:ss')}` },
  });

  if (data.closedBy) {
    embed.addFields({ name: '🔒 أغلق بواسطة', value: `${data.closedBy}`, inline: true });
  }

  if (data.closeReason) {
    embed.addFields({ name: '📝 سبب الإغلاق', value: data.closeReason, inline: false });
  }

  // Add messages as description (truncated if too long)
  const transcript = data.messages
    .map(m => `[${moment(m.timestamp).format('HH:mm:ss')}] ${m.author.tag}: ${m.content}`)
    .join('\n');

  if (transcript.length > 4000) {
    embed.setDescription(`**محادثة التذكرة (مختصر):**\n\`\`\`\n${transcript.substring(0, 3900)}...\n\`\`\``);
  } else {
    embed.setDescription(`**محادثة التذكرة:**\n\`\`\`\n${transcript}\n\`\`\``);
  }

  return embed;
}

// --------------------------------------------
// Logging Embeds
// --------------------------------------------
// --------------------------------------------
// Simple Moderation Messages (مختصرة)
// --------------------------------------------
export function simpleModMessage(
  action: 'ban' | 'kick' | 'timeout' | 'untimeout' | 'warn' | 'unwarn' | 'mute' | 'unmute' | 'role_add' | 'role_remove' | 'promote' | 'jail' | 'lockdown',
  target: User | GuildMember,
  moderator: User | GuildMember,
  reason: string,
  duration?: string
): string {
  const actionMap: Record<string, string> = {
    ban: 'حظر',
    kick: 'طرد',
    timeout: 'تايم أوت',
    untimeout: 'فك تايم أوت',
    warn: 'تحذير',
    unwarn: 'إزالة تحذير',
    mute: 'كتم',
    unmute: 'فك كتم',
    role_add: 'إضافة رول',
    role_remove: 'إزالة رول',
    promote: 'ترقية',
    jail: 'سجن',
    lockdown: 'طوارئ',
  };

  const actionText = actionMap[action] || action;
  const targetMention = target instanceof GuildMember ? target.toString() : `<@${target.id}>`;
  const modMention = moderator instanceof GuildMember ? moderator.toString() : `<@${moderator.id}>`;
  
  let msg = `✅ **تم ${actionText} للعضو ${targetMention} من قبل ${modMention}**`;
  if (reason && reason !== 'سبب غير محدد') {
    msg += `\n📝 **السبب:** ${reason}`;
  }
  if (duration) {
    msg += `\n⏱️ **المدة:** ${duration}`;
  }
  return msg;
}

export function logEmbed(data: {
  title: string;
  description: string;
  color: ColorResolvable;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  user?: User;
  channel?: TextChannel;
}): EmbedBuilder {
  const embed = createEmbed({
    title: data.title,
    description: data.description,
    color: data.color,
    fields: data.fields,
    footer: { text: 'Liberty City Logs' },
    timestamp: true,
  });

  if (data.user) {
    embed.setAuthor({ name: data.user.tag, iconURL: data.user.displayAvatarURL() });
  }

  if (data.channel) {
    embed.addFields({ name: '📍 القناة', value: `${data.channel}`, inline: true });
  }

  return embed;
}

// --------------------------------------------
// Welcome/Leave Embeds
// --------------------------------------------
export function welcomeEmbed(data: {
  user: User;
  guild: Guild;
  memberCount: number;
  message: string;
  embedColor: string;
  embedTitle: string;
  embedThumbnail?: string;
  imageEnabled?: boolean;
  imageBackground?: string;
}): EmbedBuilder {
  // صورة الخلفية: رابط مخصص أولاً، وإلا بانر السيرفر — تُعطّل تماماً إذا كانت imageEnabled=false
  const banner =
    data.imageEnabled === false
      ? undefined
      : data.imageBackground || data.guild.bannerURL({ size: 1024 }) || undefined;

  return createEmbed({
    title: data.embedTitle,
    description: data.message
      .replace('{user}', data.user.toString())
      .replace('{server}', data.guild.name)
      .replace('{count}', data.memberCount.toLocaleString()),
    color: data.embedColor as ColorResolvable,
    thumbnail: data.embedThumbnail || data.user.displayAvatarURL({ size: 256 }),
    image: banner,
    footer: { text: `${data.guild.name} | العضو #${data.memberCount}`, iconURL: data.guild.iconURL() || undefined },
    timestamp: true,
  });
}

export function leaveEmbed(data: {
  user: User;
  guild: Guild;
  memberCount: number;
  message: string;
  embedColor: string;
}): EmbedBuilder {
  return createEmbed({
    title: '👋 وداعاً',
    description: data.message
      .replace('{user}', data.user.tag)
      .replace('{server}', data.guild.name)
      .replace('{count}', data.memberCount.toLocaleString()),
    color: data.embedColor as ColorResolvable,
    thumbnail: data.user.displayAvatarURL({ size: 256 }),
    footer: { text: `${data.guild.name} | ${data.memberCount} أعضاء`, iconURL: data.guild.iconURL() || undefined },
    timestamp: true,
  });
}

// --------------------------------------------
// User Info Embed
// --------------------------------------------
export function userInfoEmbed(data: {
  user: User;
  member?: GuildMember;
  roles?: string[];
  joinedAt?: Date;
  createdAt: Date;
  badges?: string[];
}): EmbedBuilder {
  const embed = createEmbed({
    title: `👤 معلومات العضو: ${data.user.tag}`,
    color: Colors.primary,
    thumbnail: data.user.displayAvatarURL({ size: 512 }),
    fields: [
      { name: '🆔 المعرف', value: `\`${data.user.id}\``, inline: true },
      { name: '📅 إنشاء الحساب', value: `<t:${Math.floor(data.createdAt.getTime() / 1000)}:F> (<t:${Math.floor(data.createdAt.getTime() / 1000)}:R>)`, inline: true },
    ],
    footer: { text: 'Liberty City' },
    timestamp: true,
  });

  if (data.member && data.joinedAt) {
    embed.addFields({
      name: '📥 الانضمام للسيرفر',
      value: `<t:${Math.floor(data.joinedAt.getTime() / 1000)}:F> (<t:${Math.floor(data.joinedAt.getTime() / 1000)}:R>)`,
      inline: true,
    });
  }

  if (data.member && data.roles && data.roles.length > 0) {
    const rolesText = data.roles.slice(0, 10).join(' ') + (data.roles.length > 10 ? ` و ${data.roles.length - 10} أدوار أخرى...` : '');
    embed.addFields({ name: `🎭 الأدوار [${data.roles.length}]`, value: rolesText || 'لا يوجد', inline: false });
  }

  if (data.badges && data.badges.length > 0) {
    embed.addFields({ name: '🏅 الشارات', value: data.badges.join(' '), inline: true });
  }

  return embed;
}

// --------------------------------------------
// Server Info Embed
// --------------------------------------------
export function serverInfoEmbed(data: {
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
}): EmbedBuilder {
  return createEmbed({
    title: `📊 معلومات السيرفر: ${data.guild.name}`,
    color: Colors.primary,
    thumbnail: data.guild.iconURL({ size: 256 }) || undefined,
    image: data.guild.bannerURL({ size: 1024 }) || undefined,
    fields: [
      { name: '👑 المالك', value: `${data.owner}`, inline: true },
      { name: '🆔 المعرف', value: `\`${data.guild.id}\``, inline: true },
      { name: '📅 الإنشاء', value: `<t:${Math.floor(data.createdAt.getTime() / 1000)}:F>`, inline: true },
      { name: '👥 الأعضاء', value: `${data.memberCount} (${data.botCount} بوت)`, inline: true },
      { name: '📁 القنوات', value: `${data.channelCount}`, inline: true },
      { name: '🎭 الأدوار', value: `${data.roleCount}`, inline: true },
      { name: '😀 الإيموجيز', value: `${data.emojiCount}`, inline: true },
      { name: '💎 مستوى البوست', value: `المستوى ${data.boostLevel} (${data.boostCount} بوست)`, inline: true },
    ],
    footer: { text: 'Liberty City' },
    timestamp: true,
  });
}

// --------------------------------------------
// Help Embed
// --------------------------------------------
export function helpEmbed(data: {
  title: string;
  description: string;
  categories: Array<{ name: string; commands: string[]; emoji: string }>;
  prefix: string;
}): EmbedBuilder {
  const embed = createEmbed({
    title: data.title,
    description: data.description,
    color: Colors.primary,
    footer: { text: `Liberty City | استخدم ${data.prefix}help <أمر> لمزيد من التفاصيل` },
    timestamp: true,
  });

  data.categories.forEach(cat => {
    embed.addFields({
      name: `${cat.emoji} ${cat.name}`,
      value: cat.commands.map(c => `\`${c}\``).join('، '),
      inline: false,
    });
  });

  return embed;
}

// --------------------------------------------
// Pagination Embed
// --------------------------------------------
export function createPaginationEmbeds(
  items: string[],
  options: {
    title: string;
    color?: ColorResolvable;
    itemsPerPage?: number;
    footer?: string;
  }
): EmbedBuilder[] {
  const { title, color = Colors.primary, itemsPerPage = 10, footer } = options;
  const pages: EmbedBuilder[] = [];
  
  for (let i = 0; i < items.length; i += itemsPerPage) {
    const pageItems = items.slice(i, i + itemsPerPage);
    const pageNumber = Math.floor(i / itemsPerPage) + 1;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    
    const embed = createEmbed({
      title,
      description: pageItems.map((item, index) => `${i + index + 1}. ${item}`).join('\n'),
      color,
      footer: { text: `${footer || 'Liberty City'} | صفحة ${pageNumber}/${totalPages}` },
    });
    
    pages.push(embed);
  }
  
  return pages;
}

// --------------------------------------------
// Progress Bar
// --------------------------------------------
export function createProgressBar(current: number, max: number, length = 20): string {
  const percentage = Math.min(current / max, 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// --------------------------------------------
// Formatters
// --------------------------------------------
export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

export function formatDuration(ms: number): string {
  return moment.duration(ms).format('d [يوم] h [ساعة] m [دقيقة] s [ثانية]', { trim: false });
}

export function formatDate(date: Date): string {
  return moment(date).format('YYYY/MM/DD HH:mm:ss');
}

export function formatRelativeTime(date: Date): string {
  return moment(date).fromNow();
}