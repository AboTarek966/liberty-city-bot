"use strict";
// ============================================
// Liberty City Bot - Ticket Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const models_1 = require("../../models");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ticket')
        .setDescription('نظام التذاكر الشامل')
        .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('إعداد نظام التذاكر')
        .addChannelOption(opt => opt
        .setName('category')
        .setDescription('فئة التذاكر')
        .addChannelTypes(discord_js_1.ChannelType.GuildCategory)
        .setRequired(true))
        .addChannelOption(opt => opt
        .setName('log_channel')
        .setDescription('قناة سجل التذاكر')
        .addChannelTypes(discord_js_1.ChannelType.GuildText))
        .addRoleOption(opt => opt
        .setName('support_role')
        .setDescription('رول الدعم الفني')))
        .addSubcommand(sub => sub
        .setName('panel')
        .setDescription('إنشاء لوحة التذاكر')
        .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('قناة اللوحة')
        .addChannelTypes(discord_js_1.ChannelType.GuildText)
        .setRequired(true))
        .addStringOption(opt => opt
        .setName('title')
        .setDescription('عنوان اللوحة')
        .setRequired(true))
        .addStringOption(opt => opt
        .setName('description')
        .setDescription('وصف اللوحة')
        .setRequired(true))
        .addStringOption(opt => opt
        .setName('emoji')
        .setDescription('إيموجي اللوحة')
        .setRequired(false)))
        .addSubcommand(sub => sub
        .setName('close')
        .setDescription('إغلاق التذكرة الحالية')
        .addStringOption(opt => opt
        .setName('reason')
        .setDescription('سبب الإغلاق')))
        .addSubcommand(sub => sub
        .setName('claim')
        .setDescription('استلام التذكرة'))
        .addSubcommand(sub => sub
        .setName('stats')
        .setDescription('عرض إحصائيات التذاكر'))
        .addSubcommand(sub => sub
        .setName('mystats')
        .setDescription('📊 عرض عدد التذاكر التي استلمتها'))
        .addSubcommand(sub => sub
        .setName('top')
        .setDescription('🏆 أعلى 10 إداريين في استلام التذاكر'))
        .addSubcommand(sub => sub
        .setName('add')
        .setDescription('إضافة عضو للتذكرة')
        .addUserOption(opt => opt
        .setName('user')
        .setDescription('العضو')
        .setRequired(true)))
        .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('إزالة عضو من التذكرة')
        .addUserOption(opt => opt
        .setName('user')
        .setDescription('العضو')
        .setRequired(true)))
        .addSubcommand(sub => sub
        .setName('addrole')
        .setDescription('إضافة رول يمكنه استلام التذاكر')
        .addRoleOption(opt => opt
        .setName('role')
        .setDescription('الرول المضاف')
        .setRequired(true)))
        .addSubcommand(sub => sub
        .setName('removerole')
        .setDescription('إزالة رول من فريق التذاكر')
        .addRoleOption(opt => opt
        .setName('role')
        .setDescription('الرول المُزال')
        .setRequired(true)))
        .addSubcommand(sub => sub
        .setName('roles')
        .setDescription('عرض رولات فريق التذاكر'))
        .addSubcommand(sub => sub
        .setName('idle')
        .setDescription('⏳ الإغلاق التلقائي للتذاكر الخاملة (ساعة بدون نشاط)')
        .addIntegerOption(opt => opt
        .setName('hours')
        .setDescription('عدد الساعات — 0 = إيقاف الإغلاق التلقائي')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(720)))
        .addSubcommand(sub => sub
        .setName('image')
        .setDescription('🖼️ ضبط صورة/بانر لوحة التذاكر (اختياري)')
        .addAttachmentOption(opt => opt
        .setName('file')
        .setDescription('ارفع الصورة — اتركها فارغة لحذف الصورة الحالية')
        .setRequired(false)))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.SendMessages)
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        const client = interaction.client;
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'setup':
                return handleSetup(interaction, client);
            case 'panel':
                return handlePanel(interaction, client);
            case 'close':
                return handleClose(interaction, client);
            case 'claim':
                return handleClaim(interaction, client);
            case 'stats':
                return handleStats(interaction, client);
            case 'mystats':
                return handleMyStats(interaction);
            case 'top':
                return handleTop(interaction);
            case 'add':
                return handleAdd(interaction);
            case 'remove':
                return handleRemove(interaction);
            case 'addrole':
                return handleAddRole(interaction);
            case 'removerole':
                return handleRemoveRole(interaction);
            case 'roles':
                return handleListRoles(interaction);
            case 'idle':
                return handleIdle(interaction);
            case 'image':
                return handleImage(interaction, client);
        }
    },
};
// --------------------------------------------
// Panel Image (صورة/بانر اللوحة — اختياري)
// --------------------------------------------
async function handleImage(interaction, client) {
    const file = interaction.options.getAttachment('file');
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    const panels = settings.tickets.panels;
    const panel = panels[panels.length - 1];
    if (!panel) {
        await interaction.reply({ content: '⚠️ لا توجد لوحة تذاكر بعد — أنشئها أولاً بـ `/ticket panel`', ephemeral: true });
        return;
    }
    if (file) {
        if (!/\.(png|jpe?g|gif|webp)$/i.test(file.name || file.url)) {
            await interaction.reply({ content: '❌ الملف ليس صورة مدعومة (png/jpg/gif/webp)', ephemeral: true });
            return;
        }
        panel.image = file.url;
    }
    else {
        panel.image = undefined;
    }
    await settings.save();
    await client.ticketHandler.updatePanelMessage(interaction.guild, panel).catch(() => { });
    await interaction.reply({
        content: file
            ? '✅ تم ضبط الصورة كبانر للوحة وتحديث رسالة اللوحة فوراً'
            : '🗑️ تم حذف صورة اللوحة وتحديث الرسالة',
        ephemeral: true,
    });
}
// --------------------------------------------
// Idle Auto-Close (الإغلاق التلقائي عند الخمول)
// --------------------------------------------
async function handleIdle(interaction) {
    if (!interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
        return;
    }
    const hours = interaction.options.getInteger('hours', true);
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    settings.tickets.autoCloseHours = hours;
    await settings.save();
    await interaction.reply({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(hours > 0 ? embeds_1.Colors.success : embeds_1.Colors.warning)
                .setTitle('⏳ الإغلاق التلقائي')
                .setDescription(hours > 0
                ? `سيتم تحذير التذاكر الخاملة ثم إغلاقها بعد **${hours} ساعة** بدون نشاط\nيُفحص كل 15 دقيقة — وأي رسالة في التذكرة تُعيد عدّاد النشاط`
                : `تم **إيقاف** الإغلاق التلقائي — لن تُغلق أي تذكرة بسبب الخمول`)
                .setTimestamp(),
        ],
        ephemeral: true,
    });
}
// --------------------------------------------
// Add Support Role
// --------------------------------------------
async function handleAddRole(interaction) {
    const role = interaction.options.getRole('role', true);
    await interaction.deferReply({ ephemeral: true });
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    // 🛡️ حماية: منع إضافة رول البوت نفسه لفريق التذاكر
    if (role.id === interaction.guild.members.me.roles.highest.id) {
        const adminRoles = settings.tickets.adminRoleIds?.map(r => `<@&${r}>`).join('، ') || 'الإدارة العليا';
        await interaction.editReply({
            content: `🛡️ **محاولة ممنوعة:** لا يمكن إضافة رول البوت لفريق التذاكر\n` +
                `تم إبلاغ الإدارة: ${adminRoles}`,
        });
        return;
    }
    if (settings.tickets.supportRoleIds.includes(role.id)) {
        await interaction.editReply({ content: '⚠️ هذا الرول موجود بالفعل في فريق التذاكر' });
        return;
    }
    settings.tickets.supportRoleIds.push(role.id);
    await settings.save();
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('✅ تم إضافة الرول')
        .setColor(embeds_1.Colors.success)
        .setDescription(`${role} أصبح الآن من فريق الدعم ويستطيع:\n` +
        `🤝 استلام التذاكر واستلام إشعاراتها\n` +
        `📂 رؤية جميع قنوات التذاكر\n` +
        `🔒 إغلاق وحذف التذاكر`)
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// Remove Support Role
// --------------------------------------------
async function handleRemoveRole(interaction) {
    const role = interaction.options.getRole('role', true);
    await interaction.deferReply({ ephemeral: true });
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    const index = settings.tickets.supportRoleIds.indexOf(role.id);
    if (index === -1) {
        await interaction.editReply({ content: '⚠️ هذا الرول ليس في فريق التذاكر' });
        return;
    }
    settings.tickets.supportRoleIds.splice(index, 1);
    await settings.save();
    await interaction.editReply({
        content: `✅ تم إزالة ${role} من فريق التذاكر`,
    });
}
// --------------------------------------------
// List Support Roles
// --------------------------------------------
async function handleListRoles(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    const roleIds = settings.tickets.supportRoleIds;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🛡️ رولات فريق التذاكر')
        .setColor(embeds_1.Colors.primary)
        .setDescription(roleIds.length > 0
        ? roleIds.map((id) => `• <@&${id}>`).join('\n')
        : 'لا توجد رولات مُضافة بعد.\nاستخدم `/ticket addrole role:@الرول` لإضافة رول.')
        .addFields({ name: '📁 فئة التذاكر', value: settings.tickets.categoryId ? `<#${settings.tickets.categoryId}>` : 'غير محددة', inline: true }, { name: '📋 قناة السجلات', value: settings.tickets.logChannelId ? `<#${settings.tickets.logChannelId}>` : 'غير محددة', inline: true }, { name: '🔢 الحد الأقصى/عضو', value: `${settings.tickets.maxPerUser}`, inline: true })
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// Setup
// --------------------------------------------
async function handleSetup(interaction, client) {
    const category = interaction.options.getChannel('category', true);
    const logChannel = interaction.options.getChannel('log_channel');
    const supportRole = interaction.options.getRole('support_role');
    await interaction.deferReply({ ephemeral: true });
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    settings.tickets.categoryId = category.id;
    if (logChannel)
        settings.tickets.logChannelId = logChannel.id;
    if (supportRole) {
        if (!settings.tickets.supportRoleIds.includes(supportRole.id)) {
            settings.tickets.supportRoleIds.push(supportRole.id);
        }
    }
    await settings.save();
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('✅ تم إعداد نظام التذاكر')
        .setColor(embeds_1.Colors.success)
        .addFields({ name: '📁 الفئة', value: `${category}`, inline: true }, { name: '📋 قناة السجلات', value: logChannel ? `${logChannel}` : 'غير محددة', inline: true }, { name: '🛡️ رول الدعم', value: supportRole ? `${supportRole}` : 'غير محدد', inline: true }, { name: '📊 الحد الأقصى للمستخدم', value: `${settings.tickets.maxPerUser}`, inline: true })
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// Panel
// --------------------------------------------
async function handlePanel(interaction, client) {
    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const emoji = interaction.options.getString('emoji') || '🎫';
    await interaction.deferReply({ ephemeral: true });
    const result = await client.ticketHandler.createPanel(interaction.guild, channel, {
        id: '',
        name: title,
        description,
        emoji,
        type: 'select',
        fields: [],
        supportRoleIds: [],
    });
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('✅ تم إنشاء لوحة التذاكر')
        .setColor(embeds_1.Colors.success)
        .addFields({ name: '📍 القناة', value: `${channel}`, inline: true }, { name: '🆔 معرف اللوحة', value: `\`${result.panel.id}\``, inline: true }, {
        name: 'ℹ️ ملاحظات',
        value: '> • تم **استبدال** اللوحة القديمة تلقائياً (لوحة واحدة فقط)\n' +
            '> • الأنواع المكتوبة في اللوحة القديمة **تُرث تلقائياً**\n' +
            '> • عدّل النصوص والأنواع من `/settings` → 🎫 التذاكر',
        inline: false,
    })
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// Close
// --------------------------------------------
async function handleClose(interaction, client) {
    const reason = interaction.options.getString('reason');
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.guild.members.cache.get(interaction.user.id);
    // Check if this is a ticket channel
    const ticket = await models_1.Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket) {
        await interaction.editReply({
            content: '❌ هذه ليست قناة تذكرة',
        });
        return;
    }
    // Check permissions (ticket creator or support role)
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    const isSupport = settings.tickets.supportRoleIds.some((r) => member.roles.cache.has(r));
    const isCreator = ticket.userId === interaction.user.id;
    if (!isSupport && !isCreator && !member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply({
            content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة',
        });
        return;
    }
    try {
        const result = await client.ticketHandler.closeTicket(interaction.channelId, member, reason || undefined);
        // The channel will be deleted automatically
        await interaction.editReply({
            content: '✅ جارٍ إغلاق التذكرة...',
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ حدث خطأ: ${error.message}`,
        });
    }
}
// --------------------------------------------
// Claim
// --------------------------------------------
async function handleClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.guild.members.cache.get(interaction.user.id);
    // Check permissions
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    const isSupport = settings.tickets.supportRoleIds.some((r) => member.roles.cache.has(r));
    if (!isSupport && !member.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply({
            content: '❌ يجب أن تكون من فريق الدعم لاستلام التذاكر',
        });
        return;
    }
    try {
        const ticket = await client.ticketHandler.claimTicket(interaction.channelId, member);
        await interaction.editReply({
            content: `✅ تم استلام التذكرة بواسطة ${member}`,
        });
    }
    catch (error) {
        await interaction.editReply({
            content: `❌ حدث خطأ: ${error.message}`,
        });
    }
}
// --------------------------------------------
// Stats
// --------------------------------------------
async function handleStats(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const stats = await client.ticketHandler.getTicketStats(interaction.guildId);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('📊 إحصائيات التذاكر')
        .setColor(embeds_1.Colors.primary)
        .addFields({ name: '📦 إجمالي التذاكر', value: `${stats.total}`, inline: true }, { name: '🟢 مفتوحة', value: `${stats.open}`, inline: true }, { name: '🔵 مستلمة', value: `${stats.claimed}`, inline: true }, { name: '🟡 بالانتظار', value: `${stats.waiting}`, inline: true }, { name: '🔴 مغلقة', value: `${stats.closed}`, inline: true })
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// My Stats (عدد التذاكر المستلمة لهذا الإداري)
// --------------------------------------------
async function handleMyStats(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    const count = settings.tickets.claimStats?.get(interaction.user.id) || 0;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('📊 إحصائياتك في التذاكر')
        .setColor(embeds_1.Colors.primary)
        .setDescription(`👤 ${interaction.user}\n\n` +
        `🤝 **التذاكر التي استلمتها:** \`${count}\`\n\n` +
        `📌 هذا العداد يشمل فقط التذاكر التي قمت باستلامها (وليس فتحها).`)
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// Top (أعلى 10 إداريين في استلام التذاكر)
// --------------------------------------------
async function handleTop(interaction) {
    await interaction.deferReply();
    const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
    const stats = settings.tickets.claimStats;
    if (!stats || stats.size === 0) {
        await interaction.editReply({ content: '📊 لا توجد إحصائيات استلام بعد.' });
        return;
    }
    const sorted = [...stats.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = sorted.map(([userId, count], i) => {
        const medal = medals[i] || `\`${i + 1}.\``;
        return `${medal} <@${userId}> — **${count}** تذكرة`;
    });
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🏆 أعلى 10 إداريين في استلام التذاكر')
        .setColor(embeds_1.Colors.primary)
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// Add
// --------------------------------------------
async function handleAdd(interaction) {
    const target = interaction.options.getUser('user', true);
    await interaction.deferReply({ ephemeral: true });
    const ticket = await models_1.Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket) {
        await interaction.editReply({
            content: '❌ هذه ليست قناة تذكرة',
        });
        return;
    }
    const channel = interaction.channel;
    await channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
    });
    await interaction.editReply({
        content: `✅ تم إضافة ${target} إلى التذكرة`,
    });
}
// --------------------------------------------
// Remove
// --------------------------------------------
async function handleRemove(interaction) {
    const target = interaction.options.getUser('user', true);
    await interaction.deferReply({ ephemeral: true });
    const ticket = await models_1.Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket) {
        await interaction.editReply({
            content: '❌ هذه ليست قناة تذكرة',
        });
        return;
    }
    const channel = interaction.channel;
    await channel.permissionOverwrites.delete(target.id);
    await interaction.editReply({
        content: `✅ تم إزالة ${target} من التذكرة`,
    });
}
exports.default = command;
//# sourceMappingURL=ticket.js.map