"use strict";
// ============================================
// Liberty City Bot - Help Category Buttons
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const categoryInfo = {
    moderation: { name: '🛡️ الموديريشن', emoji: '🛡️' },
    protection: { name: '🔒 الحماية', emoji: '🔒' },
    tickets: { name: '🎫 التذاكر', emoji: '🎫' },
    settings: { name: '⚙️ الإعدادات', emoji: '⚙️' },
    ai: { name: '🤖 الذكاء الاصطناعي', emoji: '🤖' },
    utility: { name: '🔧 الأدوات', emoji: '🔧' },
    info: { name: 'ℹ️ المعلومات', emoji: 'ℹ️' },
};
const handler = {
    id: 'help',
    async execute(interaction) {
        await interaction.deferUpdate(); // ✅ منع انتهاء الصلاحية
        const client = interaction.client;
        const category = interaction.customId.replace('help_', '');
        const info = categoryInfo[category] || { name: category, emoji: '📂' };
        const commands = client.commandHandler.getCommandsByCategory(category);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`${info.emoji} أوامر ${info.name}`)
            .setDescription(commands.length > 0
            ? commands
                .map(cmd => `> \`/${cmd.data.name}\` — ${cmd.data.description}`)
                .join('\n')
            : 'لا توجد أوامر في هذا التصنيف')
            .setColor(embeds_1.Colors.primary)
            .setFooter({ text: 'Liberty City Bot' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = handler;
//# sourceMappingURL=help.js.map