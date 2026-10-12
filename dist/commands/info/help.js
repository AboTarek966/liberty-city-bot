"use strict";
// ============================================
// Liberty City Bot - Help Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
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
    const commands = client.commandHandler.getCommands();
    const categories = client.commandHandler.getCategories();
    const categoryInfo = {
        moderation: { name: '🛡️ الموديريشن', emoji: '🛡️' },
        protection: { name: '🔒 الحماية', emoji: '🔒' },
        tickets: { name: '🎫 التذاكر', emoji: '🎫' },
        settings: { name: '⚙️ الإعدادات', emoji: '⚙️' },
        ai: { name: '🤖 الذكاء الاصطناعي', emoji: '🤖' },
        utility: { name: '🔧 الأدوات', emoji: '🔧' },
        info: { name: 'ℹ️ المعلومات', emoji: 'ℹ️' },
        fun: { name: '🎮 الترفيه والألعاب', emoji: '🎮' },
        roles: { name: '📛 الرتب', emoji: '📛' },
    };
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('📚 أوامر Liberty City')
        .setColor(embeds_1.Colors.primary)
        .setThumbnail(interaction.client.user?.displayAvatarURL() || '');
    // قائمة مختصرة بالتصنيفات والأوامر
    const lines = [];
    for (const category of categories) {
        const info = categoryInfo[category] || { name: category, emoji: '📂' };
        const catCommands = client.commandHandler.getCommandsByCategory(category);
        if (catCommands.length > 0) {
            const names = catCommands
                .slice(0, 12)
                .map(cmd => `\`/${cmd.data.name}\``)
                .join('، ') + (catCommands.length > 12 ? ` … +${catCommands.length - 12}` : '');
            lines.push(`${info.emoji} **${info.name}** [${catCommands.length}]: ${names}`);
        }
    }
    embed.setDescription((`**${interaction.user.username}** 👋 — استخدم \`/help <أمر>\` للتفاصيل عن أمر معين\n\n` +
        lines.join('\n')).substring(0, 4000));
    // Create buttons for navigation
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('help_moderation')
        .setLabel('الموديريشن')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🛡️'), new discord_js_1.ButtonBuilder()
        .setCustomId('help_protection')
        .setLabel('الحماية')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('🔒'), new discord_js_1.ButtonBuilder()
        .setCustomId('help_tickets')
        .setLabel('التذاكر')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🎫'), new discord_js_1.ButtonBuilder()
        .setCustomId('help_ai')
        .setLabel('AI')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🤖'));
    const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId('help_fun')
        .setLabel('الترفيه')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🎮'), new discord_js_1.ButtonBuilder()
        .setCustomId('help_roles')
        .setLabel('الرتب')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('📛'), new discord_js_1.ButtonBuilder()
        .setCustomId('help_settings')
        .setLabel('الإعدادات')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('⚙️'), new discord_js_1.ButtonBuilder()
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