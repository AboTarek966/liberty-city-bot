"use strict";
// ============================================
// Omni Bot - Honeypot Channel
// ============================================
// قناة طعم: أي عضو يكتب فيها يُعتبر مخترقاً/سبام → عقوبة فورية.
// لا تُرسل فيها أي رسالة تعريفية حتى لا يعرف السبب الحقيقي.
Object.defineProperty(exports, "__esModule", { value: true });
exports.honeypotActionLabel = honeypotActionLabel;
exports.runHoneypot = runHoneypot;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const embeds_1 = require("./embeds");
const securityAlerts_1 = require("./securityAlerts");
const logger = (0, helpers_1.createLogger)('Honeypot');
const ACTION_LABELS = {
    delete: 'حذف الرسالة فقط',
    timeout: 'كتم مؤقت',
    kick: 'طرد',
    ban: 'حظر',
};
function honeypotActionLabel(action) {
    return ACTION_LABELS[action] || action;
}
/**
 * يعالج رسالة في قناة الطعم.
 * @returns true إذا تم اعتبار الرسالة مخالفةً وتوقّف باقي معالجة الرسالة.
 */
async function runHoneypot(message) {
    if (!message.guild)
        return false;
    if (message.author.id === message.client.user?.id)
        return false;
    let settings;
    try {
        settings = await (0, models_1.getGuildSettings)(message.guild.id);
    }
    catch {
        return false;
    }
    const hp = settings.honeypot;
    if (!hp?.enabled || !hp.channelId)
        return false;
    if (message.channel.id !== hp.channelId)
        return false;
    const member = message.member ||
        (await message.guild.members.fetch(message.author.id).catch(() => null));
    // تجاهل الإداريين إن كان الخيار مفعّلاً
    if (hp.ignoreAdmins !== false && member) {
        const isAdmin = member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) ||
            member.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild);
        if (isAdmin)
            return false;
    }
    const action = (hp.action || 'ban');
    const timeoutMinutes = Math.max(1, Math.min(40320, Number(hp.timeoutMinutes) || 10));
    // --------------------------------------------
    // حذف الرسالة أولاً (حتى لا يراها الآخرون)
    // --------------------------------------------
    if (hp.deleteMessage !== false) {
        await message.delete().catch(() => { });
    }
    // --------------------------------------------
    // تنفيذ العقوبة
    // --------------------------------------------
    let outcome = 'تم تسجيل المخالفة';
    if (member) {
        // 🛡️ الجدار الوقائي: الطرد/الحظر لا يكونان عند المخالفة الأولى — تحذير وتسجيل فقط
        const honeyPotFirstStrike = (action === 'kick' || action === 'ban') &&
            message.client?.securityHandler?.takeStrike?.(message.guild.id, member.id) === 'first';
        if (honeyPotFirstStrike) {
            outcome = '🛡️ الطبقة الوقائية: مخالفة أولى — تم حذف الرسالة والتسجيل فقط، بدون طرد/حظر';
        }
        else {
            try {
                if (action === 'timeout') {
                    if (!message.guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers)) {
                        outcome = '⚠️ لا أملك صلاحية كتم الأعضاء';
                    }
                    else if (message.guild.members.me &&
                        member.roles.highest.position >= message.guild.members.me.roles.highest.position) {
                        outcome = '⚠️ رتبة العضو أعلى من رتبة البوت — لم أستطع كتمه';
                    }
                    else {
                        await member.timeout(timeoutMinutes * 60_000, 'Honeypot: كتابة في قناة الطعم');
                        outcome = `🔇 تم كتمه لمدة ${timeoutMinutes} دقيقة`;
                    }
                }
                else if (action === 'kick') {
                    if (!message.guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.KickMembers)) {
                        outcome = '⚠️ لا أملك صلاحية الطرد';
                    }
                    else if (message.guild.members.me &&
                        member.roles.highest.position >= message.guild.members.me.roles.highest.position) {
                        outcome = '⚠️ رتبة العضو أعلى من رتبة البوت — لم أستطع طرده';
                    }
                    else {
                        await member.kick('Honeypot: كتابة في قناة الطعم');
                        outcome = '👢 تم طرده';
                    }
                }
                else if (action === 'ban') {
                    if (!message.guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.BanMembers)) {
                        outcome = '⚠️ لا أملك صلاحية الحظر';
                    }
                    else if (message.guild.members.me &&
                        member.roles.highest.position >= message.guild.members.me.roles.highest.position) {
                        outcome = '⚠️ رتبة العضو أعلى من رتبة البوت — لم أستطع حظره';
                    }
                    else {
                        await member.ban({
                            reason: 'Honeypot: كتابة في قناة الطعم',
                            deleteMessageSeconds: 3600,
                        });
                        outcome = '🔨 تم حظره';
                    }
                }
                else {
                    outcome = '🗑️ تم حذف الرسالة فقط';
                }
            }
            catch (error) {
                outcome = `⚠️ فشل تنفيذ العقوبة: ${error.message}`;
            }
        }
    }
    else {
        outcome = '⚠️ لم أتمكن من جلب عضويتهم';
    }
    const attachments = [...message.attachments.values()];
    const content = message.content?.trim() || '—';
    const filesLine = attachments.length
        ? attachments.map(a => `[${a.name || 'ملف'}](${a.url})`).join('، ')
        : '—';
    // --------------------------------------------
    // إشعار الرولات + السجل
    // --------------------------------------------
    const logId = hp.logChannelId || settings.protection?.logChannel;
    const alertMention = (hp.alertRoleIds || []).map((id) => `<@&${id}>`).join(' ');
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🍯 Honeypot — اصطياد مخالف')
        .setColor(embeds_1.Colors.error)
        .addFields({ name: '👤 العضو', value: `${message.author} \`${message.author.id}\``, inline: true }, {
        name: '📢 القناة',
        value: `<#${message.channel.id}>`,
        inline: true,
    }, { name: '⚙️ العقوبة', value: honeypotActionLabel(action), inline: true }, { name: '📤 النتيجة', value: outcome, inline: false }, { name: '💬 المحتوى', value: content.slice(0, 1000), inline: false }, { name: '📎 المرفقات', value: filesLine.slice(0, 1000), inline: false })
        .setFooter({
        text: `الحساب أُنشئ ${new Date(message.author.createdTimestamp).toISOString().slice(0, 10)}`,
    })
        .setTimestamp();
    let logChannel = null;
    if (logId) {
        const channel = message.guild.channels.cache.get(logId);
        if (channel && channel.isTextBased())
            logChannel = channel;
    }
    if (!(0, securityAlerts_1.securityAlertsSilent)(settings)) {
        if (logChannel) {
            await logChannel
                .send({
                content: alertMention || undefined,
                embeds: [embed],
            })
                .catch(() => { });
        }
        else {
            // لا يوجد سجل → نحاول إبلاغ الرولات في نفس القناة
            const fallback = message.channel;
            if (alertMention && fallback.isTextBased()) {
                await fallback.send({ content: alertMention, embeds: [embed] }).catch(() => { });
            }
        }
    }
    logger.warn(`Honeypot triggered by ${message.author.tag} (${message.author.id}) in ${message.guild.name} — ${outcome}`);
    return true;
}
//# sourceMappingURL=honeypot.js.map