// ============================================
// Liberty City Bot - Helper Utilities
// ============================================

import { Guild, GuildMember, User, TextChannel, Role, PermissionsBitField, ChannelType, Message, AttachmentBuilder } from 'discord.js';
import { config } from '../config';
import moment from 'moment';
import ms from 'ms';

// --------------------------------------------
// Time & Date Helpers
// --------------------------------------------
export function parseDuration(input: string): number | null {
  const parsed = ms(input);
  return parsed || null;
}

export function formatDuration(ms: number, options: { compact?: boolean; locale?: string } = {}): string {
  const { compact = false, locale = 'ar' } = options;
  
  if (compact) {
    return moment.duration(ms).format('d [يوم] h [ساعة] m [دقيقة] s [ثانية]', { trim: false });
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${locale === 'ar' ? 'يوم' : 'day'}${days > 1 && locale === 'ar' ? 'ات' : ''}`);
  if (hours % 24 > 0) parts.push(`${hours % 24} ${locale === 'ar' ? 'ساعة' : 'hour'}`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60} ${locale === 'ar' ? 'دقيقة' : 'minute'}`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60} ${locale === 'ar' ? 'ثانية' : 'second'}`);
  
  return parts.join('، ') || `${locale === 'ar' ? 'أقل من ثانية' : 'less than a second'}`;
}

export function getRelativeTime(date: Date): string {
  return moment(date).fromNow();
}

export function formatDate(date: Date, format = 'YYYY/MM/DD HH:mm:ss'): string {
  return moment(date).format(format);
}

// --------------------------------------------
// String Helpers
// --------------------------------------------
export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

export function cleanText(text: string): string {
  return text
    .replace(/@everyone/g, '@\u200beveryone')
    .replace(/@here/g, '@\u200bhere')
    .replace(/<@!?(\d+)>/g, '<@$1>')
    .replace(/<#(\d+)>/g, '<#$1>')
    .replace(/<@&(\d+)>/g, '<@&$1>');
}

export function escapeMarkdown(text: string): string {
  return text
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/-/g, '\\-')
    .replace(/\./g, '\\.')
    .replace(/\|/g, '\\|');
}

export function removeMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/> (.+)/g, '$1');
}

export function generateId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a numeric-only ID (for tickets: 1000-9999 etc.)
export function generateNumericId(length = 4): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  // Avoid leading zero
  if (result.startsWith('0')) {
    result = '1' + result.slice(1);
  }
  return result;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// --------------------------------------------
// Number Helpers
// --------------------------------------------
export function formatNumber(num: number, locale = 'ar'): string {
  return new Intl.NumberFormat(locale).format(num);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

export function roundTo(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// --------------------------------------------
// Array Helpers
// --------------------------------------------
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function uniqueArray<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function paginateArray<T>(array: T[], page: number, perPage: number): T[] {
  const start = (page - 1) * perPage;
  return array.slice(start, start + perPage);
}

// --------------------------------------------
// Discord Helpers
// --------------------------------------------
export function hasPermission(member: GuildMember, permission: bigint | bigint[], checkAdmin = true): boolean {
  if (checkAdmin && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }
  if (Array.isArray(permission)) {
    return permission.some(p => member.permissions.has(p));
  }
  return member.permissions.has(permission);
}

export function hasBotPermission(guild: Guild, permission: bigint | bigint[]): boolean {
  const me = guild.members.me;
  if (!me) return false;
  if (Array.isArray(permission)) {
    return permission.some(p => me.permissions.has(p));
  }
  return me.permissions.has(permission);
}

export function getHighestRole(member: GuildMember): Role | null {
  return member.roles.highest.id === member.guild.id ? null : member.roles.highest;
}

export function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  if (moderator.id === target.id) return false;
  if (moderator.id === moderator.guild.ownerId) return true;
  if (target.id === target.guild.ownerId) return false;
  return moderator.roles.highest.position > target.roles.highest.position;
}

export function getTextChannels(guild: Guild): TextChannel[] {
  return guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText)
    .map(c => c as TextChannel);
}

export function findChannel(guild: Guild, name: string): TextChannel | undefined {
  return guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name.toLowerCase() === name.toLowerCase()
  ) as TextChannel | undefined;
}

export function findRole(guild: Guild, name: string): Role | undefined {
  return guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
}

export function createMuteRole(guild: Guild): Promise<Role> {
  return guild.roles.create({
    name: 'Muted - Liberty City',
    color: 0x555555,
    reason: 'إنشاء رول الكتم التلقائي بواسطة Liberty City',
    permissions: [],
  });
}

export async function applyMuteRole(guild: Guild, muteRole: Role): Promise<void> {
  const channels = guild.channels.cache.filter(c => 
    c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice
  );
  
  for (const channel of channels.values()) {
    try {
      await channel.permissionOverwrites.edit(muteRole, {
        SendMessages: false,
        AddReactions: false,
        Speak: false,
        SendMessagesInThreads: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
      }, { reason: 'تطبيق صلاحيات الكتم بواسطة Liberty City' });
    } catch (error) {
      console.error(`Failed to apply mute permissions to ${channel.name}:`, error);
    }
  }
}

// --------------------------------------------
// Message Helpers
// --------------------------------------------
export function parseUserMention(mention: string): string | null {
  const match = mention.match(/^<@!?(\d+)>$/);
  return match ? match[1] : null;
}

export function parseRoleMention(mention: string): string | null {
  const match = mention.match(/^<@&(\d+)>$/);
  return match ? match[1] : null;
}

export function parseChannelMention(mention: string): string | null {
  const match = mention.match(/^<#(\d+)>$/);
  return match ? match[1] : null;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

export function containsInvite(text: string): boolean {
  const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[a-zA-Z0-9]+/g;
  return inviteRegex.test(text);
}

export function extractInvites(text: string): string[] {
  const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[a-zA-Z0-9]+/g;
  return text.match(inviteRegex) || [];
}

export function isZalgo(text: string): boolean {
  const zalgoRegex = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g;
  const matches = text.match(zalgoRegex);
  return matches ? matches.length > 10 : false;
}

export function getCapsPercentage(text: string): number {
  const letters = text.match(/[a-zA-Z\u0600-\u06FF]/g);
  if (!letters || letters.length < 3) return 0;
  const upper = letters.filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return (upper / letters.length) * 100;
}

export function countEmojis(text: string): number {
  const emojiRegex = /<a?:[a-zA-Z0-9_]+:\d+>|[\u{1F300}-\u{1F9FF}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

// --------------------------------------------
// Economy Helpers
// --------------------------------------------
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

export function calculateXpForLevel(level: number): number {
  return level * level * 100;
}

export function getXpProgress(xp: number): { current: number; next: number; progress: number } {
  const level = calculateLevel(xp);
  const currentLevelXp = calculateXpForLevel(level);
  const nextLevelXp = calculateXpForLevel(level + 1);
  const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
  return { current: xp - currentLevelXp, next: nextLevelXp - currentLevelXp, progress: Math.min(progress, 100) };
}

// --------------------------------------------
// File/Attachment Helpers
// --------------------------------------------
export function createAttachment(buffer: Buffer, name: string): AttachmentBuilder {
  return new AttachmentBuilder(buffer, { name });
}

export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url);
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);
}

// --------------------------------------------
// Cooldown Helpers
// --------------------------------------------
const cooldowns = new Map<string, Map<string, number>>();

export function setCooldown(key: string, userId: string, duration: number): void {
  if (!cooldowns.has(key)) {
    cooldowns.set(key, new Map());
  }
  cooldowns.get(key)!.set(userId, Date.now() + duration);
}

export function checkCooldown(key: string, userId: string): { onCooldown: boolean; remaining: number } {
  const userCooldowns = cooldowns.get(key);
  if (!userCooldowns) return { onCooldown: false, remaining: 0 };
  
  const expiresAt = userCooldowns.get(userId);
  if (!expiresAt) return { onCooldown: false, remaining: 0 };
  
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) {
    userCooldowns.delete(userId);
    return { onCooldown: false, remaining: 0 };
  }
  
  return { onCooldown: true, remaining };
}

export function clearCooldown(key: string, userId: string): void {
  const userCooldowns = cooldowns.get(key);
  if (userCooldowns) {
    userCooldowns.delete(userId);
  }
}

// --------------------------------------------
// Validation Helpers
// --------------------------------------------
export function isValidUserId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

export function isValidGuildId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

export function isValidChannelId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

export function isValidRoleId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

export function isValidMessageId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

// --------------------------------------------
// Async Helpers
// --------------------------------------------
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await sleep(delay);
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
}

export function timeout<T>(promise: Promise<T>, ms: number, error = new Error('Operation timed out')): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(error), ms)),
  ]);
}

// --------------------------------------------
// Environment Helpers
// --------------------------------------------
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// --------------------------------------------
// Logger Helper
// --------------------------------------------
export function createLogger(prefix: string) {
  const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
  };

  // Fixed-width, color-coded level tags
  const LEVELS = {
    DEBUG: { label: 'DEBUG', color: colors.gray },
    INFO: { label: 'INFO', color: colors.cyan },
    WARN: { label: 'WARN', color: colors.yellow },
    ERROR: { label: 'ERROR', color: `${colors.bold}${colors.red}` },
    SUCCESS: { label: 'SUCCESS', color: colors.green },
  } as const;

  type LogLevel = keyof typeof LEVELS;

  const timestamp = () => moment().format('YYYY-MM-DD HH:mm:ss');
  // "2026-10-08 23:11:21 " — used to align stack traces under the message
  const INDENT = ' '.repeat(19);

  const write = (level: LogLevel, args: any[]): void => {
    const ts = timestamp();
    const { label, color } = LEVELS[level];

    const header =
      `${colors.gray}${ts.slice(0, 10)}${colors.reset} ` +   // dimmed date
      `${ts.slice(11)} ` +                                    // normal time
      `${color}${label.padEnd(7)}${colors.reset} ` +          // aligned level tag
      `${colors.magenta}[${prefix}]${colors.reset} `;         // module prefix

    const rest = [...args];
    let message = '';
    let stack: string | null = null;

    // For the error method, print Error.message inline and its stack indented below
    if (level === 'ERROR' && rest[0] instanceof Error) {
      const err = rest.shift() as Error;
      message = err.message;
      if (err.stack) {
        stack = err.stack
          .split('\n')
          .map(line => `${INDENT}${colors.gray}${colors.dim}${line}${colors.reset}`)
          .join('\n');
      }
    }

    // Remaining args are printed space-separated after the message
    console.log(header + message, ...rest);
    if (stack) console.log(stack);
  };

  return {
    debug: (...args: any[]) => write('DEBUG', args),
    info: (...args: any[]) => write('INFO', args),
    warn: (...args: any[]) => write('WARN', args),
    error: (...args: any[]) => write('ERROR', args),
    success: (...args: any[]) => write('SUCCESS', args),
  };
}