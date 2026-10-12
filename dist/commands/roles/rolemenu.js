"use strict";
// ============================================
// Liberty City Bot - Role Menu Command (قوائم الرتب)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const models_1 = require("../../models");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('rolemenu')
        .setDescription('📛 قوائم الرتب — أعضاؤك يختارون رتبهم بأزرار جميلة')
        .addSubcommand(sub => sub
        .setName('create')
        .setDescription('إنشاء قائمة رتب جديدة')
        .addStringOption(opt => opt
        .setName('title')
        .setDescription('عنوان القائمة')
        .setRequired(true)
        .setMaxLength(100))
        .addStringOption(opt => opt
        .setName('roles')
        .setDescription('الرتب المطلوبة مفصولة بفواصل: اسم1, اسم2 (أو معرفات)')
        .setRequired(true)
        .setMaxLength(500))
        .addStringOption(opt => opt
        .setName('description')
        .setDescription('وصف اختياري للقائمة')
        .setMaxLength(500)))
        .addSubcommand(sub => sub
        .setName('list')
        .setDescription('عرض قوائم الرتب الموجودة'))
        .addSubcommand(sub => sub
        .setName('delete')
        .setDescription('حذف قائمة رتب')
        .addStringOption(opt => opt
        .setName('message_id')
        .setDescription('معرف رسالة القائمة (اقرأها من أمر list)')
        .setRequired(true)))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageRoles],
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
        await interaction.deferReply({ ephemeral: true });
        if (subcommand === 'create') {
            return handleCreate(interaction, settings);
        }
        if (subcommand === 'list') {
            return handleList(interaction, settings);
        }
        return handleDelete(interaction, settings);
    },
};
// --------------------------------------------
// Create
// --------------------------------------------
async function handleCreate(interaction, settings) {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description') || 'اضغط على الزر الخاص بالرتبة التي تريدها!';
    const rawRoles = interaction.options.getString('roles', true);
    const guild = interaction.guild;
    // Parse roles (بالاسم أو المعرف أو المنشن)
    let tokens;
    if (rawRoles.includes(',')) {
        tokens = rawRoles.split(',');
    }
    else {
        // جرّب النص كاملاً كاسم رول أولاً
        const whole = guild.roles.cache.find(r => r.name.toLowerCase() === rawRoles.trim().toLowerCase() && r.name !== '@everyone');
        tokens = whole ? [rawRoles] : rawRoles.split(/\s+/);
    }
    const roleIds = [];
    const notFound = [];
    for (const token of tokens) {
        const t = token.trim();
        if (!t)
            continue;
        let role = null;
        const mentionMatch = t.match(/^<@&(\d+)>$/);
        if (mentionMatch) {
            role = guild.roles.cache.get(mentionMatch[1]);
        }
        else if (/^\d+$/.test(t)) {
            role = guild.roles.cache.get(t);
        }
        else {
            role = guild.roles.cache.find(r => r.name.toLowerCase() === t.toLowerCase()) || null;
        }
        if (role && role.name !== '@everyone' && !role.managed && !roleIds.includes(role.id)) {
            roleIds.push(role.id);
        }
        else if (!role) {
            notFound.push(t);
        }
    }
    if (roleIds.length === 0) {
        await interaction.editReply({
            content: `❌ لم يتم العثور على أي رول. تأكد من كتابة الأسماء مفصولة بفواصل.\nمثال: \`عضو, VIP, مطور\`${notFound.length ? `\nغير موجودة: ${notFound.join('، ')}` : ''}`,
        });
        return;
    }
    if (roleIds.length > 10) {
        await interaction.editReply({ content: '❌ الحد الأقصى 10 رول في القائمة الواحدة' });
        return;
    }
    // Build buttons (2 per row)
    const roles = roleIds.map(id => guild.roles.cache.get(id));
    const rows = [];
    let current = new discord_js_1.ActionRowBuilder();
    for (const role of roles) {
        if (current.components.length >= 5) {
            rows.push(current);
            current = new discord_js_1.ActionRowBuilder();
        }
        current.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`rolemenu|${role.id}`)
            .setLabel(role.name.substring(0, 80))
            .setStyle(discord_js_1.ButtonStyle.Secondary));
    }
    if (current.components.length > 0)
        rows.push(current);
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n${roles.map(r => `• ${r}`).join('\n')}`)
        .setColor(embeds_1.Colors.primary)
        .setThumbnail(guild.iconURL({ size: 128 }) || null)
        .setFooter({ text: 'Liberty City • اضغط الزر للحصول على الرتبة / إزالتها' })
        .setTimestamp();
    const channel = interaction.channel;
    const message = await channel.send({ embeds: [embed], components: rows });
    settings.roleMenus.push({
        messageId: message.id,
        channelId: channel.id,
        title,
        roleIds,
    });
    await settings.save();
    await interaction.editReply({
        content: `✅ تم إنشاء قائمة الرتب في ${channel} — [عرض الرسالة](${message.url})\nعدد الرول: **${roleIds.length}**`,
    });
}
// --------------------------------------------
// List
// --------------------------------------------
async function handleList(interaction, settings) {
    const menus = settings.roleMenus || [];
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('📛 قوائم الرتب')
        .setColor(embeds_1.Colors.primary)
        .setDescription(menus.length > 0
        ? menus
            .map((m, i) => `**${i + 1}.** ${m.title} — <#${m.channelId}>\n` +
            `📝 معرف الرسالة: \`${m.messageId}\` (${m.roleIds.length} رول)`)
            .join('\n\n')
        : 'لا توجد قوائم بعد. أنشئ واحدة بـ `/rolemenu create`')
        .setFooter({ text: 'Liberty City Role Menu' })
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
// --------------------------------------------
// Delete
// --------------------------------------------
async function handleDelete(interaction, settings) {
    const messageId = interaction.options.getString('message_id', true).trim();
    const menus = settings.roleMenus || [];
    const index = menus.findIndex((m) => m.messageId === messageId);
    if (index === -1) {
        await interaction.editReply({ content: '❌ لم يتم العثور على قائمة بهذا المعرف. استخدم `/rolemenu list`' });
        return;
    }
    const menu = menus[index];
    // محاولة إزالة الأزرار من الرسالة
    try {
        const channel = interaction.guild.channels.cache.get(menu.channelId);
        const message = await channel?.messages.fetch(messageId);
        if (message) {
            await message.edit({ components: [] }).catch(() => { });
        }
    }
    catch {
        /* تجاهل */
    }
    menus.splice(index, 1);
    await settings.save();
    await interaction.editReply({ content: '✅ تم حذف قائمة الرتب' });
}
exports.default = command;
//# sourceMappingURL=rolemenu.js.map