"use strict";
// ============================================
// Liberty City Bot - Helper Utilities
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDuration = parseDuration;
exports.formatDuration = formatDuration;
exports.getRelativeTime = getRelativeTime;
exports.formatDate = formatDate;
exports.truncate = truncate;
exports.cleanText = cleanText;
exports.escapeMarkdown = escapeMarkdown;
exports.removeMarkdown = removeMarkdown;
exports.generateId = generateId;
exports.generateNumericId = generateNumericId;
exports.slugify = slugify;
exports.formatNumber = formatNumber;
exports.randomInt = randomInt;
exports.clamp = clamp;
exports.roundTo = roundTo;
exports.chunkArray = chunkArray;
exports.shuffleArray = shuffleArray;
exports.uniqueArray = uniqueArray;
exports.paginateArray = paginateArray;
exports.hasPermission = hasPermission;
exports.hasBotPermission = hasBotPermission;
exports.getHighestRole = getHighestRole;
exports.canModerate = canModerate;
exports.getTextChannels = getTextChannels;
exports.findChannel = findChannel;
exports.findRole = findRole;
exports.createMuteRole = createMuteRole;
exports.applyMuteRole = applyMuteRole;
exports.parseUserMention = parseUserMention;
exports.parseRoleMention = parseRoleMention;
exports.parseChannelMention = parseChannelMention;
exports.isValidUrl = isValidUrl;
exports.extractUrls = extractUrls;
exports.containsInvite = containsInvite;
exports.extractInvites = extractInvites;
exports.isZalgo = isZalgo;
exports.getCapsPercentage = getCapsPercentage;
exports.countEmojis = countEmojis;
exports.calculateLevel = calculateLevel;
exports.calculateXpForLevel = calculateXpForLevel;
exports.getXpProgress = getXpProgress;
exports.createAttachment = createAttachment;
exports.isImageUrl = isImageUrl;
exports.isVideoUrl = isVideoUrl;
exports.setCooldown = setCooldown;
exports.checkCooldown = checkCooldown;
exports.clearCooldown = clearCooldown;
exports.isValidUserId = isValidUserId;
exports.isValidGuildId = isValidGuildId;
exports.isValidChannelId = isValidChannelId;
exports.isValidRoleId = isValidRoleId;
exports.isValidMessageId = isValidMessageId;
exports.sleep = sleep;
exports.retry = retry;
exports.timeout = timeout;
exports.isDevelopment = isDevelopment;
exports.isProduction = isProduction;
exports.createLogger = createLogger;
const discord_js_1 = require("discord.js");
const moment_1 = __importDefault(require("moment"));
const ms_1 = __importDefault(require("ms"));
// --------------------------------------------
// Time & Date Helpers
// --------------------------------------------
function parseDuration(input) {
    const parsed = (0, ms_1.default)(input);
    return parsed || null;
}
function formatDuration(ms, options = {}) {
    const { compact = false, locale = 'ar' } = options;
    if (compact) {
        return moment_1.default.duration(ms).format('d [يوم] h [ساعة] m [دقيقة] s [ثانية]', { trim: false });
    }
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const parts = [];
    if (days > 0)
        parts.push(`${days} ${locale === 'ar' ? 'يوم' : 'day'}${days > 1 && locale === 'ar' ? 'ات' : ''}`);
    if (hours % 24 > 0)
        parts.push(`${hours % 24} ${locale === 'ar' ? 'ساعة' : 'hour'}`);
    if (minutes % 60 > 0)
        parts.push(`${minutes % 60} ${locale === 'ar' ? 'دقيقة' : 'minute'}`);
    if (seconds % 60 > 0)
        parts.push(`${seconds % 60} ${locale === 'ar' ? 'ثانية' : 'second'}`);
    return parts.join('، ') || `${locale === 'ar' ? 'أقل من ثانية' : 'less than a second'}`;
}
function getRelativeTime(date) {
    return (0, moment_1.default)(date).fromNow();
}
function formatDate(date, format = 'YYYY/MM/DD HH:mm:ss') {
    return (0, moment_1.default)(date).format(format);
}
// --------------------------------------------
// String Helpers
// --------------------------------------------
function truncate(str, length, suffix = '...') {
    if (str.length <= length)
        return str;
    return str.substring(0, length - suffix.length) + suffix;
}
function cleanText(text) {
    return text
        .replace(/@everyone/g, '@\u200beveryone')
        .replace(/@here/g, '@\u200bhere')
        .replace(/<@!?(\d+)>/g, '<@$1>')
        .replace(/<#(\d+)>/g, '<#$1>')
        .replace(/<@&(\d+)>/g, '<@&$1>');
}
function escapeMarkdown(text) {
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
function removeMarkdown(text) {
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
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
// Generate a numeric-only ID (for tickets: 1000-9999 etc.)
function generateNumericId(length = 4) {
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
function slugify(text) {
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
function formatNumber(num, locale = 'ar') {
    return new Intl.NumberFormat(locale).format(num);
}
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}
function roundTo(num, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}
// --------------------------------------------
// Array Helpers
// --------------------------------------------
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
function uniqueArray(array) {
    return [...new Set(array)];
}
function paginateArray(array, page, perPage) {
    const start = (page - 1) * perPage;
    return array.slice(start, start + perPage);
}
// --------------------------------------------
// Discord Helpers
// --------------------------------------------
function hasPermission(member, permission, checkAdmin = true) {
    if (checkAdmin && member.permissions.has(discord_js_1.PermissionsBitField.Flags.Administrator)) {
        return true;
    }
    if (Array.isArray(permission)) {
        return permission.some(p => member.permissions.has(p));
    }
    return member.permissions.has(permission);
}
function hasBotPermission(guild, permission) {
    const me = guild.members.me;
    if (!me)
        return false;
    if (Array.isArray(permission)) {
        return permission.some(p => me.permissions.has(p));
    }
    return me.permissions.has(permission);
}
function getHighestRole(member) {
    return member.roles.highest.id === member.guild.id ? null : member.roles.highest;
}
function canModerate(moderator, target) {
    if (moderator.id === target.id)
        return false;
    if (moderator.id === moderator.guild.ownerId)
        return true;
    if (target.id === target.guild.ownerId)
        return false;
    return moderator.roles.highest.position > target.roles.highest.position;
}
function getTextChannels(guild) {
    return guild.channels.cache
        .filter(c => c.type === discord_js_1.ChannelType.GuildText)
        .map(c => c);
}
function findChannel(guild, name) {
    return guild.channels.cache.find(c => c.type === discord_js_1.ChannelType.GuildText && c.name.toLowerCase() === name.toLowerCase());
}
function findRole(guild, name) {
    return guild.roles.cache.find(r => r.name.toLowerCase() === name.toLowerCase());
}
function createMuteRole(guild) {
    return guild.roles.create({
        name: 'Muted - Liberty City',
        color: 0x555555,
        reason: 'إنشاء رول الكتم التلقائي بواسطة Liberty City',
        permissions: [],
    });
}
async function applyMuteRole(guild, muteRole) {
    const channels = guild.channels.cache.filter(c => c.type === discord_js_1.ChannelType.GuildText || c.type === discord_js_1.ChannelType.GuildVoice);
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
        }
        catch (error) {
            console.error(`Failed to apply mute permissions to ${channel.name}:`, error);
        }
    }
}
// --------------------------------------------
// Message Helpers
// --------------------------------------------
function parseUserMention(mention) {
    const match = mention.match(/^<@!?(\d+)>$/);
    return match ? match[1] : null;
}
function parseRoleMention(mention) {
    const match = mention.match(/^<@&(\d+)>$/);
    return match ? match[1] : null;
}
function parseChannelMention(mention) {
    const match = mention.match(/^<#(\d+)>$/);
    return match ? match[1] : null;
}
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
// TLDs شائعة — لتفادي الالتقاط الخاطئ مثل file.js أو 1.2.3
const COMMON_TLDS = [
    'com', 'net', 'org', 'io', 'dev', 'gg', 'co', 'me', 'ai', 'app', 'xyz',
    'site', 'online', 'top', 'info', 'biz', 'ru', 'tv', 'link', 'click',
    'shop', 'store', 'cloud', 'tech', 'pro', 'life', 'live', 'news', 'blog',
    'club', 'fun', 'world', 'today', 'sa', 'eg', 'ae', 'uk', 'us', 'de',
    'fr', 'tr', 'cn', 'in', 'id', 'ph', 'qa', 'kw', 'ma', 'dz', 'tn', 'iq',
    'sy', 'jo', 'bh', 'om', 'pk', 'ng', 'za', 'it', 'es', 'pt', 'nl', 'se',
    'no', 'dk', 'fi', 'pl', 'cz', 'gr', 'il', 'kr', 'jp', 'au', 'ca', 'mx',
    'br', 'ar', 'ml', 'tk', 'ga', 'cf', 'gq', 'cc', 'pw', 'ws', 'icu',
    'cfd', 'rest', 'sbs', 'be', 'at', 'ch', 'ro', 'hu', 'bg', 'ua', 'by',
    'kz', 'vn', 'th', 'my', 'sg', 'hk', 'tw',
];
/**
 * استخراج الروابط من النص — يلتقط الروابط الكاملة (https://…)
 * والنطاقات بدون بروتوكول (example.com/path) مع تجنب
 * الالتقاط الخاطئ مثل أسماء الملفات (bot.js).
 */
function extractUrls(text) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+([a-z]{2,})(?:[/?#][^\s]*)?/gi;
    const found = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const raw = match[0];
        // استبعد التطابق إذا كان جزءاً من كلمة (يسبقه حرف أو رقم)
        const prev = match.index > 0 ? text[match.index - 1] : '';
        if (prev && /[a-z0-9]/i.test(prev))
            continue;
        const hasScheme = /^https?:\/\//i.test(raw);
        const tld = match[1].toLowerCase();
        // بدون بروتوكول: اسم النطاق يجب أن ينتهي بـ TLD معروف
        if (!hasScheme && !COMMON_TLDS.includes(tld))
            continue;
        found.push(raw);
    }
    return [...new Set(found)];
}
function containsInvite(text) {
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[a-zA-Z0-9]+/g;
    return inviteRegex.test(text);
}
function extractInvites(text) {
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[a-zA-Z0-9]+/g;
    return text.match(inviteRegex) || [];
}
function isZalgo(text) {
    const zalgoRegex = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g;
    const matches = text.match(zalgoRegex);
    return matches ? matches.length > 10 : false;
}
function getCapsPercentage(text) {
    const letters = text.match(/[a-zA-Z\u0600-\u06FF]/g);
    if (!letters || letters.length < 3)
        return 0;
    const upper = letters.filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length;
    return (upper / letters.length) * 100;
}
function countEmojis(text) {
    const emojiRegex = /<a?:[a-zA-Z0-9_]+:\d+>|[\u{1F300}-\u{1F9FF}]/gu;
    const matches = text.match(emojiRegex);
    return matches ? matches.length : 0;
}
// --------------------------------------------
// Economy Helpers
// --------------------------------------------
function calculateLevel(xp) {
    return Math.floor(Math.sqrt(xp / 100));
}
function calculateXpForLevel(level) {
    return level * level * 100;
}
function getXpProgress(xp) {
    const level = calculateLevel(xp);
    const currentLevelXp = calculateXpForLevel(level);
    const nextLevelXp = calculateXpForLevel(level + 1);
    const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
    return { current: xp - currentLevelXp, next: nextLevelXp - currentLevelXp, progress: Math.min(progress, 100) };
}
// --------------------------------------------
// File/Attachment Helpers
// --------------------------------------------
function createAttachment(buffer, name) {
    return new discord_js_1.AttachmentBuilder(buffer, { name });
}
function isImageUrl(url) {
    return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url);
}
function isVideoUrl(url) {
    return /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url);
}
// --------------------------------------------
// Cooldown Helpers
// --------------------------------------------
const cooldowns = new Map();
function setCooldown(key, userId, duration) {
    if (!cooldowns.has(key)) {
        cooldowns.set(key, new Map());
    }
    cooldowns.get(key).set(userId, Date.now() + duration);
}
function checkCooldown(key, userId) {
    const userCooldowns = cooldowns.get(key);
    if (!userCooldowns)
        return { onCooldown: false, remaining: 0 };
    const expiresAt = userCooldowns.get(userId);
    if (!expiresAt)
        return { onCooldown: false, remaining: 0 };
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
        userCooldowns.delete(userId);
        return { onCooldown: false, remaining: 0 };
    }
    return { onCooldown: true, remaining };
}
function clearCooldown(key, userId) {
    const userCooldowns = cooldowns.get(key);
    if (userCooldowns) {
        userCooldowns.delete(userId);
    }
}
// --------------------------------------------
// Validation Helpers
// --------------------------------------------
function isValidUserId(id) {
    return /^\d{17,19}$/.test(id);
}
function isValidGuildId(id) {
    return /^\d{17,19}$/.test(id);
}
function isValidChannelId(id) {
    return /^\d{17,19}$/.test(id);
}
function isValidRoleId(id) {
    return /^\d{17,19}$/.test(id);
}
function isValidMessageId(id) {
    return /^\d{17,19}$/.test(id);
}
// --------------------------------------------
// Async Helpers
// --------------------------------------------
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function retry(fn, retries = 3, delay = 1000, backoff = 2) {
    try {
        return await fn();
    }
    catch (error) {
        if (retries <= 0)
            throw error;
        await sleep(delay);
        return retry(fn, retries - 1, delay * backoff, backoff);
    }
}
function timeout(promise, ms, error = new Error('Operation timed out')) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(error), ms)),
    ]);
}
// --------------------------------------------
// Environment Helpers
// --------------------------------------------
function isDevelopment() {
    return process.env.NODE_ENV !== 'production';
}
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
// --------------------------------------------
// Logger Helper
// --------------------------------------------
function createLogger(prefix) {
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
    };
    const timestamp = () => (0, moment_1.default)().format('YYYY-MM-DD HH:mm:ss');
    // "2026-10-08 23:11:21 " — used to align stack traces under the message
    const INDENT = ' '.repeat(19);
    const write = (level, args) => {
        const ts = timestamp();
        const { label, color } = LEVELS[level];
        const header = `${colors.gray}${ts.slice(0, 10)}${colors.reset} ` + // dimmed date
            `${ts.slice(11)} ` + // normal time
            `${color}${label.padEnd(7)}${colors.reset} ` + // aligned level tag
            `${colors.magenta}[${prefix}]${colors.reset} `; // module prefix
        const rest = [...args];
        let message = '';
        let stack = null;
        // For the error method, print Error.message inline and its stack indented below
        if (level === 'ERROR' && rest[0] instanceof Error) {
            const err = rest.shift();
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
        if (stack)
            console.log(stack);
    };
    return {
        debug: (...args) => write('DEBUG', args),
        info: (...args) => write('INFO', args),
        warn: (...args) => write('WARN', args),
        error: (...args) => write('ERROR', args),
        success: (...args) => write('SUCCESS', args),
    };
}
//# sourceMappingURL=helpers.js.map