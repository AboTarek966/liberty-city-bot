"use strict";
// ============================================
// Liberty City Bot - Guild Member Add Event
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
exports.handleWelcome = handleWelcome;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const emoji_1 = require("../utils/emoji");
const models_1 = require("../models");
const embeds_1 = require("../utils/embeds");
const logger = (0, helpers_1.createLogger)('Event:GuildMemberAdd');
const event = {
    name: 'guildMemberAdd',
    async execute(member) {
        const client = member.client;
        try {
            // Anti-Raid check
            const raidResult = await client.protectionHandler.checkRaid(member);
            if (raidResult.isRaid && raidResult.action) {
                logger.warn(`Raid detected in ${member.guild.name}!`);
                // Execute raid action
                if (raidResult.action.type === 'kick' || raidResult.action.type === 'ban') {
                    if (raidResult.action.type === 'ban') {
                        await member.ban({ reason: raidResult.action.reason }).catch(() => { });
                    }
                    else {
                        await member.kick(raidResult.action.reason).catch(() => { });
                    }
                }
                // Log the raid
                await logRaid(member, raidResult.action.reason);
                return;
            }
            // 🛡️ Anti-Bot: طرد بوت غير مصرح به (يُتخطى الترحيب تلقائياً)
            const botKicked = await client.securityHandler.onMemberJoin(member);
            if (botKicked)
                return;
            // 🕵️ Anti-Alt Detection — كشف الحسابات البديلة
            await client.antiAltHandler.onMemberJoin(member);
            // 📨 Invite Tracker — تتبع الدعوة المستخدمة
            await client.inviteTrackerHandler.onMemberJoin(member);
            // Auto-Role
            await handleAutoRole(member);
            // Welcome message
            const welcomeResult = await handleWelcome(member);
            if (welcomeResult !== 'sent' && welcomeResult !== 'disabled') {
                logger.warn(`Welcome skipped for ${member.user.tag}: ${welcomeResult}`);
            }
            // Log member join
            await logMemberJoin(member);
        }
        catch (error) {
            logger.error('Error in guildMemberAdd:', error);
        }
    },
};
// --------------------------------------------
// Auto-Role
// --------------------------------------------
async function handleAutoRole(member) {
    try {
        const settings = await (0, models_1.getGuildSettings)(member.guild.id);
        if (!settings.autorole?.enabled || !settings.autorole?.roleId)
            return;
        const role = member.guild.roles.cache.get(settings.autorole.roleId);
        if (!role)
            return;
        await member.roles.add(role, 'Liberty City - Auto-Role');
        logger.info(`Auto-role ${role.name} given to ${member.user.tag}`);
    }
    catch (error) {
        logger.warn(`Failed to give auto-role to ${member.user.tag}:`, error);
    }
}
/** رسالة الترحيب الخاصة (مشتركة بين الإمبد والبطاقة المرسومة) */
async function sendWelcomeDm(member, settings) {
    if (!settings.welcome.dmEnabled)
        return;
    const dmMessage = (settings.welcome.dmMessage || 'مرحباً بك في {server}! نتمنى لك وقتاً ممتعاً.')
        .replace(/{user}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g, member.guild.memberCount.toString());
    const guildIcon = member.guild.iconURL();
    await member
        .send({
        embeds: [
            {
                color: 0x00d4ff,
                title: `👋 مرحباً بك في ${member.guild.name}!`,
                description: dmMessage,
                ...(guildIcon ? { thumbnail: { url: guildIcon } } : {}),
                footer: { text: 'Liberty City' },
                timestamp: new Date().toISOString(),
            },
        ],
    })
        .catch(() => { }); // Ignore DM failures
}
async function handleWelcome(member, opts = {}) {
    const settings = await (0, models_1.getGuildSettings)(member.guild.id);
    if (!settings.welcome?.enabled && !opts.force)
        return 'disabled';
    const channelId = settings.welcome.channelId;
    if (!channelId)
        return 'no-channel';
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel || channel.type !== discord_js_1.ChannelType.GuildText)
        return 'bad-channel';
    // Format welcome message (+ 🎨 تحويل اختصارات الإيموجي إلى إيموجي حقيقي)
    const message = (0, emoji_1.resolveEmojiShortcodes)((settings.welcome.message || '🎉 مرحباً {user}! أهلاً بك في {server}')
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{user\.tag}/g, member.user.tag)
        .replace(/{user\.name}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g, member.guild.memberCount.toString())
        .replace(/{member\.count}/g, member.guild.memberCount.toString()), member.guild);
    // 🖼️ بطاقة مخصصة (ProBot-style): صورة مرسومة بدل الإمبد
    const cardCfg = settings.welcome.card;
    if (cardCfg?.enabled) {
        try {
            const { renderWelcomeCard, CARD_DEFAULTS } = await Promise.resolve().then(() => __importStar(require('../utils/welcomeCard')));
            // دمج مع القيم الافتراضية لضمان وجود كل الخصائص الجديدة
            const fullConfig = { ...CARD_DEFAULTS, ...cardCfg };
            const buffer = await renderWelcomeCard(member, fullConfig);
            const cardContent = message.trim() || `<@${member.id}>`;
            await channel.send({
                content: cardContent,
                files: [{ attachment: buffer, name: 'welcome-card.png' }],
            });
            logger.info(`Welcomed ${member.user.tag} to ${member.guild.name} (card)`);
            await sendWelcomeDm(member, settings);
            return 'sent';
        }
        catch (error) {
            logger.error('Welcome card failed, falling back to embed:', error);
            // فشل الرسم → نتابع للإمبد العادي
        }
    }
    // Send welcome embed
    const embed = (0, embeds_1.welcomeEmbed)({
        user: member.user,
        guild: member.guild,
        memberCount: member.guild.memberCount,
        message,
        embedColor: settings.welcome.embedColor || '#00D4FF',
        embedTitle: settings.welcome.embedTitle || 'مرحباً بك!',
        embedThumbnail: settings.welcome.embedThumbnail,
        imageEnabled: settings.welcome.imageEnabled,
        imageBackground: settings.welcome.imageBackground,
    });
    const ok = await channel
        .send({ content: `<@${member.id}>`, embeds: [embed] })
        .then(() => true)
        .catch((err) => {
        logger.error('Failed to send welcome message:', err);
        return false;
    });
    if (!ok)
        return 'failed';
    // Send DM if enabled
    await sendWelcomeDm(member, settings);
    logger.info(`Welcomed ${member.user.tag} to ${member.guild.name}`);
    return 'sent';
}
// --------------------------------------------
// Log Member Join
// --------------------------------------------
async function logMemberJoin(member) {
    const client = member.client;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleMemberJoin(member).catch((err) => client.loggingHandler.reportFailure('guildMemberAdd', err));
}
// --------------------------------------------
// Log Raid
// --------------------------------------------
async function logRaid(member, reason) {
    const settings = await (0, models_1.getGuildSettings)(member.guild.id);
    if (!settings.logging?.enabled || !settings.logging.channelId)
        return;
    const logChannel = member.guild.channels.cache.get(settings.logging.channelId);
    if (!logChannel || logChannel.type !== discord_js_1.ChannelType.GuildText)
        return;
    const embed = (0, embeds_1.logEmbed)({
        title: '🚨 تم رصد هجوم!',
        description: reason,
        color: '#FF3366',
        user: member.user,
        fields: [
            { name: '👤 العضو', value: `${member}`, inline: true },
            { name: '🆔 المعرف', value: `\`${member.id}\``, inline: true },
        ],
    });
    await logChannel.send({ embeds: [embed] }).catch(() => { });
}
exports.default = event;
//# sourceMappingURL=guildMemberAdd.js.map