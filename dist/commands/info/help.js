"use strict";
// ============================================
// Omni Bot - Help Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
/**
 * 📂 أسماء وأيقونات تصنيفات /help
 * emoji = اسم إيموجي السيرفر، fallback = إيموجي يونيكود لو مش موجود
 */
const CATEGORY_INFO = {
    moderation: { name: 'أوامر الادارة', emoji: 'staff~2', fallback: '🛡️' },
    protection: { name: 'أوامر الحماية', emoji: 'consideration', fallback: '🔒' },
    tickets: { name: 'أوامر التذاكر', emoji: 'ticket~2', fallback: '🎫' },
    settings: { name: 'أوامر الاعدادات', emoji: 'correct', fallback: '⚙️' },
    ai: { name: 'الذكاء الاصطناعي', emoji: 'chat~1', fallback: '🤖' },
    roles: { name: 'أوامر الرتب', emoji: 'notebook~1', fallback: '📛' },
    fun: { name: 'أوامر الترفيه والألعاب', emoji: '🎮', fallback: '🎮' },
    utility: { name: 'أوامر الأدوات', emoji: '🔧', fallback: '🔧' },
    info: { name: 'أوامر المعلومات', emoji: 'ℹ️', fallback: 'ℹ️' },
};
/**
 * 🔎 إيجاد إيموجي السيرفر بالاسم.
 * يدعم الأسماء المكررة بصيغة `name~2` (ثاني إيموجي بنفس الاسم).
 */
function findGuildEmoji(guild, name) {
    if (!guild)
        return null;
    const all = [...guild.emojis.cache.values()];
    if (!all.length)
        return null;
    const lower = name.toLowerCase();
    let found = all.find(e => e.name?.toLowerCase() === lower);
    if (!found) {
        const m = /^(.+?)~(\d+)$/.exec(name);
        if (m) {
            const base = m[1].toLowerCase();
            const index = Math.max(1, parseInt(m[2], 10)) - 1;
            found = all.filter(e => e.name?.toLowerCase() === base)[index];
        }
    }
    return found || null;
}
/** 🎨 إيموجي جاهز لأزرار ديسكورد (كائن)، أو الاحتياطي */
function guildEmoji(guild, name, fallback) {
    const found = findGuildEmoji(guild, name);
    if (!found)
        return fallback;
    return { id: found.id, name: found.name, animated: found.animated };
}
/** 🎨 إيموجي جاهز للنصوص/الإمبد `<:name:id>`، أو الاحتياطي */
function guildEmojiText(guild, name, fallback) {
    const found = findGuildEmoji(guild, name);
    if (!found)
        return fallback;
    return `<${found.animated ? 'a' : ''}:${found.name}:${found.id}>`;
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('help')
        .setDescription('عرض جميع الأوامر المتاحة')
        .addStringOption(option => option
        .setName('command')
        .setDescription('اسم الأمر للحصول على معلومات تفصيلية')
        .setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        const client = interaction.client;
        const commandName = interaction.options.getString('command');
        // Show specific command info
        if (commandName) {
            return showCommandInfo(interaction, client, commandName);
        }
        // Show help menu
        return showHelpMenu(interaction, client);
    },
};
// --------------------------------------------
// Show Help Menu
// --------------------------------------------
async function showHelpMenu(interaction, client) {
    const categories = client.commandHandler.getCategories();
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`📚 أوامر ${interaction.guild.name}`)
        .setColor(embeds_1.Colors.primary)
        .setThumbnail(interaction.client.user?.displayAvatarURL() || '');
    // قائمة مختصرة بالتصنيفات والأوامر
    const lines = [];
    for (const category of categories) {
        const info = CATEGORY_INFO[category] || { name: category, emoji: '📂', fallback: '📂' };
        const catCommands = client.commandHandler.getCommandsByCategory(category);
        if (catCommands.length > 0) {
            const names = catCommands
                .slice(0, 12)
                .map(cmd => `\`/${cmd.data.name}\``)
                .join('، ') + (catCommands.length > 12 ? ` … +${catCommands.length - 12}` : '');
            lines.push(`${guildEmojiText(interaction.guild, info.emoji, info.fallback)} **${info.name}** [${catCommands.length}]: ${names}`);
        }
    }
    embed.setDescription((`**${interaction.user.username}** 👋 — استخدم \`/help <أمر>\` للتفاصيل عن أمر معين\n\n` +
        lines.join('\n')).substring(0, 4000));
    // Create buttons for navigation
    const emojiOf = (key) => {
        const info = CATEGORY_INFO[key];
        return info ? guildEmoji(interaction.guild, info.emoji, info.fallback) : '📂';
    };
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('help_moderation')
        .setLabel(CATEGORY_INFO.moderation.name)
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji(emojiOf('moderation')), new discord_js_1.ButtonBuilder()
        .setCustomId('help_protection')
        .setLabel(CATEGORY_INFO.protection.name)
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji(emojiOf('protection')), new discord_js_1.ButtonBuilder()
        .setCustomId('help_tickets')
        .setLabel(CATEGORY_INFO.tickets.name)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji(emojiOf('tickets')), new discord_js_1.ButtonBuilder()
        .setCustomId('help_ai')
        .setLabel(CATEGORY_INFO.ai.name)
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji(emojiOf('ai')));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('help_fun')
        .setLabel('الترفيه')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🎮'), new discord_js_1.ButtonBuilder()
        .setCustomId('help_roles')
        .setLabel(CATEGORY_INFO.roles.name)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji(emojiOf('roles')), new discord_js_1.ButtonBuilder()
        .setCustomId('help_settings')
        .setLabel(CATEGORY_INFO.settings.name)
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji(emojiOf('settings')), new discord_js_1.ButtonBuilder()
        .setCustomId('help_utility')
        .setLabel('الأدوات')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🔧'), new discord_js_1.ButtonBuilder()
        .setCustomId('help_info')
        .setLabel('معلومات')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('ℹ️'));
    await interaction.reply({
        embeds: [embed],
        components: [row, row2],
    });
}
// --------------------------------------------
// Show Command Info
// --------------------------------------------
async function showCommandInfo(interaction, client, commandName) {
    const command = client.commandHandler.getCommand(commandName);
    if (!command) {
        await interaction.reply({
            content: `❌ الأمر \`${commandName}\` غير موجود. استخدم \`/help\` لعرض جميع الأوامر`,
            ephemeral: true,
        });
        return;
    }
    const data = command.data;
    const options = data.options || [];
    const parts = [
        `📋 **/${data.name}** — ${data.description}`,
        `📂 ${command.category || 'غير مصنف'} • ⏱️ ${command.cooldown ? `${command.cooldown} ثانية` : 'بدون كولداون'}`,
        `🔐 ${command.permissions && command.permissions.length > 0
            ? command.permissions.map(p => `\`${p}\``).join(', ')
            : 'لا توجد صلاحيات مطلوبة'}`,
    ];
    // معلومات الوسائط
    if (options.length > 0) {
        parts.push(`📝 ${options
            .map((opt) => `\`/${data.name} ${opt.name}\` ${opt.required ? '(مطلوب)' : '(اختياري)'}`)
            .join('، ')}`);
    }
    // مثال على الاستخدام
    parts.push(`💡 \`/${data.name}${options.length > 0 ? ' ' + options.map((o) => `<${o.name}>`).join(' ') : ''}\``);
    await interaction.reply({
        content: parts.join(' • '),
        ephemeral: true,
    });
}
exports.default = command;
//# sourceMappingURL=help.js.map