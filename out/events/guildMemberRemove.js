"use strict";
// ============================================
// Liberty City Bot - Guild Member Remove Event
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLeave = handleLeave;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const emoji_1 = require("../utils/emoji");
const models_1 = require("../models");
const embeds_1 = require("../utils/embeds");
const logger = (0, helpers_1.createLogger)('Event:GuildMemberRemove');
const event = {
    name: 'guildMemberRemove',
    async execute(member) {
        try {
            // 🛡️ Anti-Nuke: رصد الطرد الجماعي + ربط المطرودين برابط الدعوة
            //    (لا يُعطّل رحلة المغادرة — ينفّذ بمعزل عن باقي العمل)
            //    ⚠️ قبل هذه الإضافة كان الطرد الجماعي يمرّ بلا أي استجابة
            ;
            member.client.securityHandler
                .onMemberKick(member)
                .catch(err => logger.warn(`onMemberKick failed: ${err?.message ?? err}`));
            // 📨 Invite Tracker — تحديث إحصائيات المغادرة
            member.client.inviteTrackerHandler
                .onMemberLeave(member)
                .catch(err => logger.warn(`inviteTracker onMemberLeave failed: ${err?.message ?? err}`));
            // Leave message
            const leaveResult = await handleLeave(member);
            if (leaveResult !== 'sent' && leaveResult !== 'disabled') {
                logger.warn(`Leave message skipped for ${member.user.tag}: ${leaveResult}`);
            }
            // Log member leave
            await logMemberLeave(member);
            // Cleanup user data (optional - keep for rejoin)
        }
        catch (error) {
            logger.error('Error in guildMemberRemove:', error);
        }
    },
};
async function handleLeave(member, opts = {}) {
    const settings = await (0, models_1.getGuildSettings)(member.guild.id);
    if (!settings.leave?.enabled && !opts.force)
        return 'disabled';
    const channelId = settings.leave.channelId;
    if (!channelId)
        return 'no-channel';
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel || channel.type !== discord_js_1.ChannelType.GuildText)
        return 'bad-channel';
    // Format leave message (+ 🎨 تحويل اختصارات الإيموجي إلى إيموجي حقيقي)
    const message = (0, emoji_1.resolveEmojiShortcodes)((settings.leave.message || 'وداعاً {user}! نتمنى لك التوفيق.')
        .replace(/{user}/g, member.user.tag)
        .replace(/{user\.mention}/g, `<@${member.id}>`)
        .replace(/{user\.name}/g, member.user.username)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g, member.guild.memberCount.toString())
        .replace(/{member\.count}/g, member.guild.memberCount.toString()), member.guild);
    // Send leave embed
    const embed = (0, embeds_1.leaveEmbed)({
        user: member.user,
        guild: member.guild,
        memberCount: member.guild.memberCount,
        message,
        embedColor: settings.leave.embedColor || '#FF3366',
    });
    const ok = await channel
        .send({ embeds: [embed] })
        .then(() => true)
        .catch((err) => {
        logger.error('Failed to send leave message:', err);
        return false;
    });
    if (!ok)
        return 'failed';
    logger.info(`${member.user.tag} left ${member.guild.name}`);
    return 'sent';
}
// --------------------------------------------
// Log Member Leave
// --------------------------------------------
async function logMemberLeave(member) {
    const client = member.client;
    // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
    client.loggingHandler.handleMemberLeave(member).catch((err) => client.loggingHandler.reportFailure('guildMemberRemove', err));
    // Handle open tickets
    await handleMemberTickets(member);
}
// --------------------------------------------
// Handle Member's Open Tickets
// --------------------------------------------
async function handleMemberTickets(member) {
    try {
        const openTickets = await models_1.Ticket.find({
            guildId: member.guild.id,
            userId: member.id,
            status: { $in: ['open', 'claimed', 'waiting'] },
        });
        for (const ticket of openTickets) {
            const channel = member.guild.channels.cache.get(ticket.channelId);
            if (channel && channel.type === discord_js_1.ChannelType.GuildText) {
                await channel.send({
                    content: `⚠️ مقدم التذكرة ${member.user.tag} غادر السيرفر.`,
                }).catch(() => { });
            }
        }
    }
    catch (error) {
        logger.error('Error handling member tickets:', error);
    }
}
exports.default = event;
//# sourceMappingURL=guildMemberRemove.js.map