"use strict";
// ============================================
// Omni Bot - Help Category Buttons
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const categoryInfo = {
    moderation: { name: 'أوامر الادارة', emoji: '🛡️' },
    protection: { name: 'أوامر الحماية', emoji: '🔒' },
    tickets: { name: 'أوامر التذاكر', emoji: '🎫' },
    settings: { name: 'أوامر الاعدادات', emoji: '⚙️' },
    ai: { name: 'الذكاء الاصطناعي', emoji: '🤖' },
    roles: { name: 'أوامر الرتب', emoji: '📛' },
    fun: { name: 'أوامر الترفيه والألعاب', emoji: '🎮' },
    utility: { name: 'أوامر الأدوات', emoji: '🔧' },
    info: { name: 'أوامر المعلومات', emoji: 'ℹ️' },
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
            .setTitle(`${info.emoji} ${info.name}`)
            .setDescription(commands.length > 0
            ? commands
                .map(cmd => `> \`/${cmd.data.name}\` — ${cmd.data.description}`)
                .join('\n')
            : 'لا توجد أوامر في هذا التصنيف')
            .setColor(embeds_1.Colors.primary)
            .setFooter({ text: interaction.guild?.name || 'Omni' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = handler;
//# sourceMappingURL=help.js.map