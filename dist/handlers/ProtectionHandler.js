"use strict";
// ============================================
// Liberty City Bot - Protection Handler
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtectionHandler = void 0;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const models_1 = require("../models");
const helpers_2 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('ProtectionHandler');
// --------------------------------------------
// Protection Handler Class
// --------------------------------------------
class ProtectionHandler {
    client;
    // Trackers
    spamTracker = new discord_js_1.Collection(); // key: userId_channelId
    raidTracker = new discord_js_1.Collection(); // key: guildId
    userCooldowns = new discord_js_1.Collection(); // key: userId_action
    constructor(client) {
        this.client = client;
    }
    // --------------------------------------------
    // Webhook Spam Handler — Death Note / Raid Webhooks
    // --------------------------------------------
    webhookSpamCooldown = new Map();
    async handleWebhookMessage(message) {
        if (!message.guild || !message.webhookId)
            return false;
        const settings = await (0, models_1.getGuildSettings)(message.guild.id);
        if (!settings.protection)
            return false;
        // فحص: هل الرسالة تحتوي @everyone أو mentions كتيرة أو رابط دعوة؟
        const isMassMention = message.mentions.everyone ||
            message.mentions.users.size >= 5 ||
            message.mentions.roles.size >= 3;
        const isInvite = /discord\.(gg|com\/invite)|discordapp\.com\/invite/i.test(message.content);
        const isScamLink = /(?:free|nitro|steam|airdrop|claim).*(?:discord\.gg|bit\.ly|tinyurl|cutt\.ly)/i.test(message.content);
        if (!isMassMention && !isInvite && !isScamLink)
            return false;
        // Rate limit: webhook cooldown 5 ثواني
        const key = `${message.guild.id}:${message.webhookId}`;
        const lastAction = this.webhookSpamCooldown.get(key) || 0;
        if (Date.now() - lastAction < 5000) {
            // احذف الرسالة فقط بدون تكرار الإجراء
            await message.delete().catch(() => { });
            return true;
        }
        this.webhookSpamCooldown.set(key, Date.now());
        // 1) احذف الرسالة فوراً
        await message.delete().catch(() => { });
        // 2) احذف الـ Webhook نفسه
        let webhookDeleted = false;
        try {
            const channel = message.channel;
            if (channel && 'webhooks' in channel) {
                const webhooks = await channel.webhooks.fetch();
                const target = webhooks.find((w) => w.id === message.webhookId);
                if (target) {
                    await target.delete('Liberty City — Anti-Webhook-Spam');
                    webhookDeleted = true;
                }
            }
        }
        catch (e) {
            logger.warn(`Failed to delete webhook ${message.webhookId}: ${e.message}`);
        }
        // 3) ابحث عن المنفّذ عبر Audit Log
        let executor = null;
        try {
            const audit = await message.guild.fetchAuditLogs({ limit: 10, type: discord_js_1.AuditLogEvent.WebhookCreate });
            const entry = audit.entries.find(e => e.target?.id === message.webhookId &&
                Date.now() - e.createdTimestamp < 60000);
            if (entry)
                executor = entry.executor;
        }
        catch { }
        // 4) اعاقب المنفّذ لو موجود
        let punished = false;
        if (executor && !executor.bot) {
            try {
                const member = await message.guild.members.fetch(executor.id).catch(() => null);
                if (member && !member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
                    await member.kick('Liberty City — Anti-Webhook-Spam (Death Note)');
                    punished = true;
                }
            }
            catch { }
        }
        // 5) سجّل + أرسل تنبيه
        logger.warn(`🚨 WEBHOOK SPAM in ${message.guild.name}: deleted ${webhookDeleted ? 'webhook' : 'message only'}, ` +
            `punished=${punished}, executor=${executor?.tag || 'unknown'}, ` +
            `reason=${isMassMention ? '@everyone' : isInvite ? 'invite' : 'scam-link'}`);
        // إرسال تنبيه لقروم الحماية
        try {
            const logChannelId = settings.protection?.logChannel;
            if (logChannelId) {
                const logChannel = await message.guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel && 'send' in logChannel) {
                    const { EmbedBuilder } = await Promise.resolve().then(() => __importStar(require('discord.js')));
                    const embed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('🚨 Webhook Spam — Death Note')
                        .addFields({ name: 'القناة', value: message.channel?.name || 'unknown', inline: true }, { name: 'حذف الـ Webhook', value: webhookDeleted ? '✅ نعم' : '❌ لا', inline: true }, { name: 'المنفّذ', value: executor?.tag || 'غير معروف', inline: true }, { name: 'العقوبة', value: punished ? '✅ تم طرد المنفّذ' : '❌ لم يتم', inline: true }, { name: 'السبب', value: isMassMention ? '@everyone mass mention' : isInvite ? 'Invite link' : 'Scam link', inline: true })
                        .setTimestamp();
                    await logChannel.send({ embeds: [embed] });
                }
            }
        }
        catch { }
        return true;
    }
    // --------------------------------------------
    // Main Message Check
    // --------------------------------------------
    async checkMessage(message) {
        if (!message.guild || !message.member)
            return null;
        // 🚨 Webhook messages — Death Note / Raid protection
        if (message.webhookId) {
            await this.handleWebhookMessage(message);
            return null;
        }
        if (message.author.bot)
            return null;
        const settings = await (0, models_1.getGuildSettings)(message.guild.id);
        // Skip if protection is disabled
        if (!settings.protection)
            return null;
        // Skip if user has ignored roles
        if (this.hasIgnoredRole(message.member, settings))
            return null;
        // Skip if channel is ignored
        if (this.isIgnoredChannel(message.channel.id, settings))
            return null;
        const hasAdministrator = message.member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator);
        const isAdmin = hasAdministrator ||
            message.member.permissions.has(discord_js_1.PermissionFlagsBits.ManageMessages);
        // Check each protection type — الإدارين يتجاوزون الحماية العامة فقط
        // requiresAdministrator: تجاوز الكلمات المحظورة (السب) لمن يملك Administrator فقط
        const checks = [
            { name: 'antiSpam', check: this.checkAntiSpam.bind(this), adminBypass: true },
            { name: 'antiLink', check: this.checkAntiLink.bind(this), adminBypass: true },
            { name: 'antiInvite', check: this.checkAntiInvite.bind(this), adminBypass: true },
            { name: 'antiMention', check: this.checkAntiMention.bind(this), adminBypass: true },
            { name: 'antiCaps', check: this.checkAntiCaps.bind(this), adminBypass: true },
            { name: 'antiEmoji', check: this.checkAntiEmoji.bind(this), adminBypass: true },
            { name: 'autoMod', check: this.checkAutoMod.bind(this), adminBypass: true, requiresAdministrator: true },
            { name: 'zalgo', check: this.checkZalgo.bind(this), adminBypass: false }, // للكل
        ];
        for (const { name, check, adminBypass, requiresAdministrator } of checks) {
            // ⚡ يتجاوز هذا الفحص؟ (الأمراء فقط للسب، وبقية الإدارين لبقية الحمايات)
            if (adminBypass && (requiresAdministrator ? hasAdministrator : isAdmin))
                continue;
            const action = await check(message, settings);
            if (action) {
                await this.executeAction(message, action, settings);
                return action;
            }
        }
        return null;
    }
    // --------------------------------------------
    // Anti-Spam
    // --------------------------------------------
    async checkAntiSpam(message, settings) {
        const { antiSpam } = settings.protection;
        if (!antiSpam.enabled)
            return null;
        const key = `${message.author.id}_${message.channel.id}`;
        const now = Date.now();
        const timeWindow = antiSpam.timeWindow;
        const maxMessages = antiSpam.maxMessages;
        let tracker = this.spamTracker.get(key);
        if (!tracker || now - tracker.firstMessage > timeWindow) {
            tracker = {
                messages: 1,
                firstMessage: now,
                lastMessage: now,
            };
            this.spamTracker.set(key, tracker);
            return null;
        }
        tracker.messages++;
        tracker.lastMessage = now;
        if (tracker.messages > maxMessages) {
            // Reset tracker
            this.spamTracker.delete(key);
            return {
                type: antiSpam.action,
                reason: 'الرسائل المزعجة (Anti-Spam)',
                duration: antiSpam.muteDuration,
            };
        }
        return null;
    }
    // --------------------------------------------
    // Anti-Link
    // --------------------------------------------
    async checkAntiLink(message, settings) {
        const { antiLink } = settings.protection;
        if (!antiLink.enabled)
            return null;
        // Check if user has ignored role
        if (antiLink.ignoreRoles?.some((roleId) => message.member?.roles.cache.has(roleId))) {
            return null;
        }
        const urls = (0, helpers_2.extractUrls)(message.content);
        if (urls.length === 0)
            return null;
        // Check if all URLs are whitelisted
        const nonWhitelistedUrls = urls.filter(url => {
            return !antiLink.whitelist.some((domain) => url.includes(domain));
        });
        if (nonWhitelistedUrls.length === 0)
            return null;
        return {
            type: antiLink.action,
            reason: 'روابط غير مسموح بها (Anti-Link)',
        };
    }
    // --------------------------------------------
    // Anti-Invite
    // --------------------------------------------
    async checkAntiInvite(message, settings) {
        const { antiInvite } = settings.protection;
        if (!antiInvite.enabled)
            return null;
        // Check if user has ignored role
        if (antiInvite.ignoreRoles?.some((roleId) => message.member?.roles.cache.has(roleId))) {
            return null;
        }
        if (!(0, helpers_2.containsInvite)(message.content))
            return null;
        return {
            type: antiInvite.action,
            reason: 'دعوات ديسكورد (Anti-Invite)',
        };
    }
    // --------------------------------------------
    // Anti-Mention
    // --------------------------------------------
    async checkAntiMention(message, settings) {
        const { antiMention } = settings.protection;
        if (!antiMention.enabled)
            return null;
        const mentionCount = message.mentions.users.size +
            message.mentions.roles.size +
            (message.mentions.everyone ? 2 : 0);
        if (mentionCount <= antiMention.max)
            return null;
        return {
            type: antiMention.action,
            reason: 'المنشن الجماعي (Anti-Mention)',
        };
    }
    // --------------------------------------------
    // Anti-Caps
    // --------------------------------------------
    async checkAntiCaps(message, settings) {
        const { antiCaps } = settings.protection;
        if (!antiCaps.enabled)
            return null;
        if (message.content.length < antiCaps.minLength)
            return null;
        const capsPercentage = (0, helpers_2.getCapsPercentage)(message.content);
        if (capsPercentage < antiCaps.percentage)
            return null;
        return {
            type: antiCaps.action,
            reason: 'الأحرف الكبيرة (Anti-Caps)',
        };
    }
    // --------------------------------------------
    // Anti-Emoji
    // --------------------------------------------
    async checkAntiEmoji(message, settings) {
        const { antiEmoji } = settings.protection;
        if (!antiEmoji.enabled)
            return null;
        const emojiCount = (0, helpers_2.countEmojis)(message.content);
        if (emojiCount <= antiEmoji.max)
            return null;
        return {
            type: antiEmoji.action,
            reason: 'الإيموجي السبام (Anti-Emoji)',
        };
    }
    // --------------------------------------------
    // AutoMod (Bad Words)
    // --------------------------------------------
    async checkAutoMod(message, settings) {
        const { automod } = settings;
        if (!automod || !automod.enabled)
            return null;
        // Check ignored roles
        if (automod.ignoredRoles?.some((roleId) => message.member?.roles.cache.has(roleId))) {
            return null;
        }
        const content = message.content.toLowerCase();
        const foundWord = automod.badWords.find((word) => content.includes(word.toLowerCase()));
        if (!foundWord)
            return null;
        return {
            type: automod.badWordsAction,
            reason: `كلمة محظورة: ${foundWord}`,
            duration: automod.badWordsDuration,
        };
    }
    // --------------------------------------------
    // Check Zalgo
    // --------------------------------------------
    async checkZalgo(message, settings) {
        const { automod } = settings;
        if (!automod || !automod.enabled || !automod.zalgoEnabled)
            return null;
        if (!(0, helpers_2.isZalgo)(message.content))
            return null;
        return {
            type: automod.zalgoAction,
            reason: 'Zalgo Text (Anti-Zalgo)',
        };
    }
    // --------------------------------------------
    // Execute Protection Action
    // --------------------------------------------
    async executeAction(message, action, settings) {
        try {
            // Delete the message first
            if (message.deletable) {
                await message.delete().catch(() => { });
            }
            // Send warning to user
            const warningEmbed = {
                color: 0xff3366,
                title: '⚠️ تم حذف رسالتك',
                description: `سبب: ${action.reason}`,
                footer: { text: 'Liberty City Protection' },
                timestamp: new Date().toISOString(),
            };
            const warningMessage = message.channel.isTextBased() && 'send' in message.channel
                ? await message.channel.send({
                    embeds: [warningEmbed],
                }).catch(() => null)
                : null;
            // Auto-delete warning after 5 seconds
            if (warningMessage) {
                setTimeout(() => {
                    warningMessage.delete().catch(() => { });
                }, 5000);
            }
            // Execute action on user
            await this.executeUserAction(message, action);
            // Log to mod logs channel
            await this.logAction(message, action, settings);
            logger.info(`Protection action ${action.type} on ${message.author.tag}: ${action.reason}`);
        }
        catch (error) {
            logger.error('Failed to execute protection action:', error);
        }
    }
    // --------------------------------------------
    // Execute User Action
    // --------------------------------------------
    async executeUserAction(message, action) {
        const member = message.member;
        if (!member)
            return;
        // Check if bot can moderate
        if (!member.moderatable)
            return;
        switch (action.type) {
            case 'warn':
                // Warning is already shown
                break;
            case 'mute':
                await member.timeout(action.duration || 300000, action.reason).catch(() => { });
                break;
            case 'kick':
                await member.kick(action.reason).catch(() => { });
                break;
            case 'ban':
                await message.guild?.members.ban(message.author.id, {
                    reason: action.reason,
                    deleteMessageSeconds: 3600,
                }).catch(() => { });
                break;
        }
    }
    // --------------------------------------------
    // Log Action
    // --------------------------------------------
    async logAction(message, action, settings) {
        // Find log channel
        const logChannelId = settings.protection?.[this.getProtectionKey(action.reason)]?.logChannel
            || settings.logging?.channelId;
        if (!logChannelId)
            return;
        const logChannel = message.guild?.channels.cache.get(logChannelId);
        if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
            return;
        const logEmbed = {
            color: action.type === 'ban' || action.type === 'kick' ? 0xff3366 : 0xffd700,
            title: `🛡️ حماية: ${action.reason}`,
            fields: [
                { name: '👤 العضو', value: `${message.author} (${message.author.id})`, inline: true },
                { name: '📍 القناة', value: `${message.channel}`, inline: true },
                { name: '⚙️ الإجراء', value: action.type, inline: true },
                { name: '📝 الرسالة', value: message.content.substring(0, 1000) || 'N/A', inline: false },
            ],
            footer: { text: 'Liberty City Protection Logs' },
            timestamp: new Date().toISOString(),
        };
        await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
    }
    // --------------------------------------------
    // Anti-Raid (Member Join)
    // --------------------------------------------
    async checkRaid(member) {
        const settings = await (0, models_1.getGuildSettings)(member.guild.id);
        const { antiRaid } = settings.protection;
        if (!antiRaid.enabled)
            return { isRaid: false };
        const guildId = member.guild.id;
        const now = Date.now();
        const timeWindow = antiRaid.timeWindow;
        const threshold = antiRaid.threshold;
        let tracker = this.raidTracker.get(guildId);
        if (!tracker || now - tracker.firstJoin > timeWindow) {
            tracker = {
                joins: 1,
                firstJoin: now,
            };
            this.raidTracker.set(guildId, tracker);
            return { isRaid: false };
        }
        tracker.joins++;
        if (tracker.joins > threshold) {
            // Raid detected!
            this.raidTracker.delete(guildId);
            const action = {
                type: antiRaid.action === 'lockdown' ? 'kick' : antiRaid.action,
                reason: 'هجوم DDoS/Raid على السيرفر',
            };
            // If lockdown, lock all channels
            if (antiRaid.action === 'lockdown') {
                await this.lockdown(member.guild);
            }
            return { isRaid: true, action };
        }
        return { isRaid: false };
    }
    // --------------------------------------------
    // Lockdown
    // --------------------------------------------
    async lockdown(guild) {
        const channels = guild.channels.cache.filter((c) => c.type === discord_js_1.ChannelType.GuildText || c.type === discord_js_1.ChannelType.GuildVoice);
        for (const channel of channels.values()) {
            try {
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false,
                    Connect: false,
                }, { reason: 'Anti-Raid Lockdown' });
            }
            catch (error) {
                logger.error(`Failed to lockdown channel ${channel.name}:`, error);
            }
        }
        logger.info(`Locked down guild ${guild.name}`);
    }
    // --------------------------------------------
    // Utility Methods
    // --------------------------------------------
    hasIgnoredRole(member, settings) {
        const ignoredRoles = [
            ...(settings.protection?.antiLink?.ignoreRoles || []),
            ...(settings.protection?.antiInvite?.ignoreRoles || []),
            ...(settings.automod?.ignoredRoles || []),
        ];
        return ignoredRoles.some((roleId) => member.roles.cache.has(roleId));
    }
    isIgnoredChannel(channelId, settings) {
        const ignoredChannels = [
            ...(settings.automod?.ignoredChannels || []),
            ...(settings.logging?.ignoredChannels || []),
        ];
        return ignoredChannels.includes(channelId);
    }
    getProtectionKey(reason) {
        if (reason.includes('Anti-Spam'))
            return 'antiSpam';
        if (reason.includes('Anti-Link'))
            return 'antiLink';
        if (reason.includes('Anti-Invite'))
            return 'antiInvite';
        if (reason.includes('Anti-Mention'))
            return 'antiMention';
        if (reason.includes('Anti-Caps'))
            return 'antiCaps';
        if (reason.includes('Anti-Emoji'))
            return 'antiEmoji';
        return 'antiRaid';
    }
    // --------------------------------------------
    // Cleanup Old Trackers
    // --------------------------------------------
    cleanup() {
        const now = Date.now();
        // Clean spam trackers
        this.spamTracker.forEach((tracker, key) => {
            if (now - tracker.lastMessage > 30000) { // 30 seconds
                this.spamTracker.delete(key);
            }
        });
        // Clean raid trackers
        this.raidTracker.forEach((tracker, guildId) => {
            if (now - tracker.firstJoin > 300000) { // 5 minutes
                this.raidTracker.delete(guildId);
            }
        });
        // Clean user cooldowns
        this.userCooldowns.forEach((timestamp, key) => {
            if (now - timestamp > 300000) { // 5 minutes
                this.userCooldowns.delete(key);
            }
        });
    }
}
exports.ProtectionHandler = ProtectionHandler;
exports.default = ProtectionHandler;
//# sourceMappingURL=ProtectionHandler.js.map