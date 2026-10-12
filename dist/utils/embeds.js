"use strict";
// ============================================
// Liberty City Bot - Embed Utilities
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Colors = void 0;
exports.createEmbed = createEmbed;
exports.successEmbed = successEmbed;
exports.errorEmbed = errorEmbed;
exports.warningEmbed = warningEmbed;
exports.infoEmbed = infoEmbed;
exports.primaryEmbed = primaryEmbed;
exports.moderationEmbed = moderationEmbed;
exports.ticketEmbed = ticketEmbed;
exports.ticketTranscriptEmbed = ticketTranscriptEmbed;
exports.simpleModMessage = simpleModMessage;
exports.logEmbed = logEmbed;
exports.welcomeEmbed = welcomeEmbed;
exports.leaveEmbed = leaveEmbed;
exports.userInfoEmbed = userInfoEmbed;
exports.serverInfoEmbed = serverInfoEmbed;
exports.helpEmbed = helpEmbed;
exports.createPaginationEmbeds = createPaginationEmbeds;
exports.createProgressBar = createProgressBar;
exports.formatNumber = formatNumber;
exports.formatDuration = formatDuration;
exports.formatDate = formatDate;
exports.formatRelativeTime = formatRelativeTime;
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const moment_1 = __importDefault(require("moment"));
require("moment-duration-format");
// --------------------------------------------
// Color Helpers
// --------------------------------------------
exports.Colors = {
    primary: config_1.config.discord.colors.primary,
    success: config_1.config.discord.colors.success,
    warning: config_1.config.discord.colors.warning,
    error: config_1.config.discord.colors.error,
    info: config_1.config.discord.colors.info,
    // Discord.js colors (numeric values)
    ...discord_js_1.Colors,
};
// --------------------------------------------
// Base Embed Creator
// --------------------------------------------
function createEmbed(options) {
    const embed = new discord_js_1.EmbedBuilder();
    if (options.title)
        embed.setTitle(options.title);
    if (options.description)
        embed.setDescription(options.description);
    if (options.color)
        embed.setColor(options.color);
    if (options.fields)
        embed.addFields(options.fields);
    if (options.footer)
        embed.setFooter(options.footer);
    if (options.thumbnail)
        embed.setThumbnail(options.thumbnail);
    if (options.image)
        embed.setImage(options.image);
    if (options.author)
        embed.setAuthor(options.author);
    if (options.timestamp !== false)
        embed.setTimestamp();
    if (options.url)
        embed.setURL(options.url);
    return embed;
}
// --------------------------------------------
// Predefined Embed Types
// --------------------------------------------
function successEmbed(title, description, footer) {
    return createEmbed({
        title: `✅ ${title}`,
        description,
        color: exports.Colors.success,
        footer: footer ? { text: footer } : undefined,
    });
}
function errorEmbed(title, description, footer) {
    return createEmbed({
        title: `❌ ${title}`,
        description,
        color: exports.Colors.error,
        footer: footer ? { text: footer } : undefined,
    });
}
function warningEmbed(title, description, footer) {
    return createEmbed({
        title: `⚠️ ${title}`,
        description,
        color: exports.Colors.warning,
        footer: footer ? { text: footer } : undefined,
    });
}
function infoEmbed(title, description, footer) {
    return createEmbed({
        title: `ℹ️ ${title}`,
        description,
        color: exports.Colors.info,
        footer: footer ? { text: footer } : undefined,
    });
}
function primaryEmbed(title, description, footer) {
    return createEmbed({
        title,
        description,
        color: exports.Colors.primary,
        footer: footer ? { text: footer } : undefined,
    });
}
// --------------------------------------------
// Moderation Embeds
// --------------------------------------------
function moderationEmbed(data) {
    const typeEmojis = {
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
    const typeNames = {
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
        color: (data.type === 'ban' || data.type === 'kick' ? exports.Colors.error :
            data.type === 'mute' || data.type === 'timeout' || data.type === 'role_remove' ? exports.Colors.warning :
                data.type === 'warn' ? exports.Colors.warning : exports.Colors.success),
        fields: [
            { name: '👤 العضو', value: `${data.target} (\`${data.target.id}\`)`, inline: true },
            { name: '🛡️ المنفذ', value: `${data.moderator} (\`${data.moderator.id}\`)`, inline: true },
            { name: '📋 السبب', value: data.reason, inline: false },
            { name: '🔢 رقم القضية', value: `#${data.caseId}`, inline: true },
        ],
        footer: { text: `Liberty City | ${(0, moment_1.default)().format('YYYY/MM/DD HH:mm:ss')}` },
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
function ticketEmbed(data) {
    const statusEmojis = {
        open: '🟢',
        claimed: '🔵',
        waiting: '🟡',
        closed: '🔴',
    };
    const priorityColors = {
        low: exports.Colors.success,
        medium: exports.Colors.info,
        high: exports.Colors.warning,
        urgent: exports.Colors.error,
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
function ticketTranscriptEmbed(data) {
    const embed = createEmbed({
        title: `📜 نسخة التذكرة #${data.ticketId}`,
        color: exports.Colors.info,
        fields: [
            { name: '👤 العضو', value: `${data.user} (\`${data.user.id}\`)`, inline: true },
            { name: '📂 النوع', value: data.type, inline: true },
            { name: '📊 الحالة', value: data.status, inline: true },
        ],
        footer: { text: `Liberty City | ${(0, moment_1.default)().format('YYYY/MM/DD HH:mm:ss')}` },
    });
    if (data.closedBy) {
        embed.addFields({ name: '🔒 أغلق بواسطة', value: `${data.closedBy}`, inline: true });
    }
    if (data.closeReason) {
        embed.addFields({ name: '📝 سبب الإغلاق', value: data.closeReason, inline: false });
    }
    // Add messages as description (truncated if too long)
    const transcript = data.messages
        .map(m => `[${(0, moment_1.default)(m.timestamp).format('HH:mm:ss')}] ${m.author.tag}: ${m.content}`)
        .join('\n');
    if (transcript.length > 4000) {
        embed.setDescription(`**محادثة التذكرة (مختصر):**\n\`\`\`\n${transcript.substring(0, 3900)}...\n\`\`\``);
    }
    else {
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
function simpleModMessage(action, target, moderator, reason, duration) {
    const actionMap = {
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
    const targetMention = target instanceof discord_js_1.GuildMember ? target.toString() : `<@${target.id}>`;
    const modMention = moderator instanceof discord_js_1.GuildMember ? moderator.toString() : `<@${moderator.id}>`;
    let msg = `✅ **تم ${actionText} للعضو ${targetMention} من قبل ${modMention}**`;
    if (reason && reason !== 'سبب غير محدد') {
        msg += `\n📝 **السبب:** ${reason}`;
    }
    if (duration) {
        msg += `\n⏱️ **المدة:** ${duration}`;
    }
    return msg;
}
function logEmbed(data) {
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
function welcomeEmbed(data) {
    // صورة الخلفية: رابط مخصص أولاً، وإلا بانر السيرفر — تُعطّل تماماً إذا كانت imageEnabled=false
    const banner = data.imageEnabled === false
        ? undefined
        : data.imageBackground || data.guild.bannerURL({ size: 1024 }) || undefined;
    return createEmbed({
        title: data.embedTitle,
        description: data.message
            .replace('{user}', data.user.toString())
            .replace('{server}', data.guild.name)
            .replace('{count}', data.memberCount.toLocaleString()),
        color: data.embedColor,
        thumbnail: data.embedThumbnail || data.user.displayAvatarURL({ size: 256 }),
        image: banner,
        footer: { text: `${data.guild.name} | العضو #${data.memberCount}`, iconURL: data.guild.iconURL() || undefined },
        timestamp: true,
    });
}
function leaveEmbed(data) {
    return createEmbed({
        title: '👋 وداعاً',
        description: data.message
            .replace('{user}', data.user.tag)
            .replace('{server}', data.guild.name)
            .replace('{count}', data.memberCount.toLocaleString()),
        color: data.embedColor,
        thumbnail: data.user.displayAvatarURL({ size: 256 }),
        footer: { text: `${data.guild.name} | ${data.memberCount} أعضاء`, iconURL: data.guild.iconURL() || undefined },
        timestamp: true,
    });
}
// --------------------------------------------
// User Info Embed
// --------------------------------------------
function userInfoEmbed(data) {
    const embed = createEmbed({
        title: `👤 معلومات العضو: ${data.user.tag}`,
        color: exports.Colors.primary,
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
function serverInfoEmbed(data) {
    return createEmbed({
        title: `📊 معلومات السيرفر: ${data.guild.name}`,
        color: exports.Colors.primary,
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
function helpEmbed(data) {
    const embed = createEmbed({
        title: data.title,
        description: data.description,
        color: exports.Colors.primary,
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
function createPaginationEmbeds(items, options) {
    const { title, color = exports.Colors.primary, itemsPerPage = 10, footer } = options;
    const pages = [];
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
function createProgressBar(current, max, length = 20) {
    const percentage = Math.min(current / max, 1);
    const filled = Math.round(percentage * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
// --------------------------------------------
// Formatters
// --------------------------------------------
function formatNumber(num) {
    if (num >= 1e9)
        return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6)
        return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3)
        return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
}
function formatDuration(ms) {
    return moment_1.default.duration(ms).format('d [يوم] h [ساعة] m [دقيقة] s [ثانية]', { trim: false });
}
function formatDate(date) {
    return (0, moment_1.default)(date).format('YYYY/MM/DD HH:mm:ss');
}
function formatRelativeTime(date) {
    return (0, moment_1.default)(date).fromNow();
}
//# sourceMappingURL=embeds.js.map