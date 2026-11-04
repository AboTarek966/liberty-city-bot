"use strict";
// ============================================
// Omni Bot - Honeypot Command
// ============================================
// /honeypot setup | disable | status
// قناة طعم: أي رسالة فيها تُحذف ويُعاقب صاحبها فوراً.
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const honeypot_1 = require("../../utils/honeypot");
const ACTIONS = ['delete', 'timeout', 'kick', 'ban'];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('honeypot')
        .setDescription('🍯 قناة الطعم — اصطياد المخترقين والسبام فوراً')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('إعداد قناة الطعم والعقوبة')
        .addChannelOption(o => o
        .setName('channel')
        .setDescription('القناة التي يُمنع الكتابة فيها (قناة الطعم)')
        .setRequired(true)
        .addChannelTypes(discord_js_1.ChannelType.GuildText))
        .addStringOption(o => o
        .setName('action')
        .setDescription('العقوبة عند الكتابة في القناة')
        .addChoices({ name: '🗑️ حذف الرسالة فقط', value: 'delete' }, { name: '🔇 كتم مؤقت', value: 'timeout' }, { name: '👢 طرد', value: 'kick' }, { name: '🔨 حظر', value: 'ban' }))
        .addIntegerOption(o => o
        .setName('timeout_minutes')
        .setDescription('مدة الكتم بالدقائق (عند اختيار كتم)')
        .setMinValue(1)
        .setMaxValue(40320))
        .addChannelOption(o => o
        .setName('log_channel')
        .setDescription('قناة سجل الاصطياد')
        .addChannelTypes(discord_js_1.ChannelType.GuildText))
        .addStringOption(o => o
        .setName('alert_roles')
        .setDescription('رولات يتم منشنها عند الاصطياد (آيديات/منشن مفصولة بمسافة)')
        .setMaxLength(500))
        .addBooleanOption(o => o.setName('delete_message').setDescription('حذف رسالة المخالف (افتراضي: نعم)'))
        .addBooleanOption(o => o.setName('ignore_admins').setDescription('استثناء الإداريين من العقوبة (افتراضي: نعم)')))
        .addSubcommand(sub => sub.setName('disable').setDescription('إيقاف قناة الطعم'))
        .addSubcommand(sub => sub.setName('status').setDescription('عرض إعدادات قناة الطعم')),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageGuild],
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        if (sub === 'setup') {
            await interaction.deferReply({ ephemeral: true });
            const channel = interaction.options.getChannel('channel', true);
            const action = (interaction.options.getString('action') || 'ban');
            if (!ACTIONS.includes(action)) {
                await interaction.editReply({ content: '❌ عقوبة غير معروفة' });
                return;
            }
            if (action !== 'delete' && action !== 'timeout' && action !== 'kick' && action !== 'ban') {
                await interaction.editReply({ content: '❌ عقوبة غير صالحة' });
                return;
            }
            const me = guild.members.me;
            const missing = [];
            if (me) {
                if (action === 'delete' && !me.permissions.has(discord_js_1.PermissionFlagsBits.ManageMessages)) {
                    missing.push('إدارة الرسائل');
                }
                if (action === 'timeout' && !me.permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers)) {
                    missing.push('كتم الأعضاء');
                }
                if (action === 'kick' && !me.permissions.has(discord_js_1.PermissionFlagsBits.KickMembers)) {
                    missing.push('طرد الأعضاء');
                }
                if (action === 'ban' && !me.permissions.has(discord_js_1.PermissionFlagsBits.BanMembers)) {
                    missing.push('حظر الأعضاء');
                }
            }
            if (missing.length) {
                await interaction.editReply({
                    content: `❌ **صلاحيات ناقصة للبوت:** ${missing.join('، ')}\n> امنح البوت الصلاحيات ثم أعد المحاولة.`,
                });
                return;
            }
            // استخراج آيديات الرولات من النص (منشن أو رقم)
            const alertRaw = interaction.options.getString('alert_roles') || '';
            const alertRoleIds = Array.from(new Set((alertRaw.match(/\d{17,20}/g) || []).filter(id => guild.roles.cache.has(id))));
            settings.honeypot = {
                enabled: true,
                channelId: channel.id,
                action,
                timeoutMinutes: interaction.options.getInteger('timeout_minutes') || 10,
                logChannelId: interaction.options.getChannel('log_channel')?.id || settings.honeypot?.logChannelId,
                alertRoleIds,
                deleteMessage: interaction.options.getBoolean('delete_message') ?? true,
                ignoreAdmins: interaction.options.getBoolean('ignore_admins') ?? true,
            };
            await settings.save();
            (0, models_1.invalidateGuildSettings)(guild.id);
            await interaction.editReply({
                content: `✅ **تم تفعيل قناة الطعم**\n` +
                    `> 📢 القناة: ${channel}\n` +
                    `> ⚙️ العقوبة: **${(0, honeypot_1.honeypotActionLabel)(action)}**${action === 'timeout' ? ` (${settings.honeypot.timeoutMinutes} دقيقة)` : ''}\n` +
                    `> 🗑️ حذف الرسالة: ${settings.honeypot.deleteMessage ? '✅' : '❌'}\n` +
                    `> 🛡️ استثناء الإداريين: ${settings.honeypot.ignoreAdmins ? '✅' : '❌'}\n` +
                    `> 📋 السجل: ${settings.honeypot.logChannelId ? `<#${settings.honeypot.logChannelId}>` : '—'}\n` +
                    `> 🔔 منشن: ${alertRoleIds.length ? alertRoleIds.map(id => `<@&${id}>`).join('، ') : '—'}\n\n` +
                    `> ⚠️ **لا تكتب في القناة أبداً** — أي رسالة فيها تُعتبر مخالفة.`,
            });
            return;
        }
        if (sub === 'disable') {
            if (!settings.honeypot) {
                await interaction.reply({ content: '⚠️ قناة الطعم غير مُعدّة أصلاً', ephemeral: true });
                return;
            }
            settings.honeypot.enabled = false;
            await settings.save();
            (0, models_1.invalidateGuildSettings)(guild.id);
            await interaction.reply({ content: '🔴 **تم إيقاف قناة الطعم**', ephemeral: true });
            return;
        }
        // status
        const hp = settings.honeypot;
        if (!hp) {
            await interaction.reply({
                content: '📭 قناة الطعم غير مُعدّة — استخدم `/honeypot setup`',
                ephemeral: true,
            });
            return;
        }
        const channel = hp.channelId ? guild.channels.cache.get(hp.channelId) : null;
        const log = hp.logChannelId ? guild.channels.cache.get(hp.logChannelId) : null;
        const me = guild.members.me;
        const canPunish = !me ||
            (hp.action === 'delete' && me.permissions.has(discord_js_1.PermissionFlagsBits.ManageMessages)) ||
            (hp.action === 'timeout' && me.permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers)) ||
            (hp.action === 'kick' && me.permissions.has(discord_js_1.PermissionFlagsBits.KickMembers)) ||
            (hp.action === 'ban' && me.permissions.has(discord_js_1.PermissionFlagsBits.BanMembers));
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🍯 إعدادات قناة الطعم')
            .setColor(hp.enabled ? embeds_1.Colors.success : embeds_1.Colors.error)
            .addFields({ name: '⚡ الحالة', value: hp.enabled ? '🟢 مفعّلة' : '🔴 معطّلة', inline: true }, { name: '📢 القناة', value: channel ? `${channel}` : '❌ غير محددة', inline: true }, { name: '⚙️ العقوبة', value: (0, honeypot_1.honeypotActionLabel)(hp.action), inline: true }, {
            name: '⏱️ مدة الكتم',
            value: hp.action === 'timeout' ? `${hp.timeoutMinutes} دقيقة` : '—',
            inline: true,
        }, { name: '🗑️ حذف الرسالة', value: hp.deleteMessage ? '✅' : '❌', inline: true }, { name: '🛡️ استثناء الإداريين', value: hp.ignoreAdmins ? '✅' : '❌', inline: true }, { name: '📋 السجل', value: log ? `${log}` : '—', inline: true }, {
            name: '🔔 منشن',
            value: hp.alertRoleIds?.length
                ? hp.alertRoleIds.map((id) => `<@&${id}>`).join('، ')
                : '—',
            inline: false,
        }, {
            name: '✅ جاهزية البوت',
            value: canPunish ? '🟢 يملك الصلاحيات المطلوبة' : '🔴 صلاحيات ناقصة — راجع إعدادات الرول',
            inline: false,
        })
            .setFooter({ text: `${guild.name} • Honeypot` })
            .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
exports.default = command;
//# sourceMappingURL=honeypot.js.map