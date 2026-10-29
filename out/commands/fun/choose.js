"use strict";
// ============================================
// Liberty City Bot - Choose Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('choose')
        .setDescription('🎲 اختر لي بين خيارات — مفصولة بفواصل')
        .addStringOption(opt => opt
        .setName('options')
        .setDescription('الخيارات مفصولة بفواصل: بيتزا, برجر, شاورما')
        .setRequired(true)
        .setMaxLength(300)),
    cooldown: 3,
    async execute(interaction) {
        const raw = interaction.options.getString('options', true);
        const options = raw
            .split(',')
            .map(o => o.trim())
            .filter(o => o.length > 0);
        if (options.length < 2) {
            await interaction.reply({
                content: '❌ اكتب خيارين على الأقل مفصولة بفواصل (`, `)',
                ephemeral: true,
            });
            return;
        }
        const picked = options[Math.floor(Math.random() * options.length)];
        await interaction.reply({ content: `🎲 أختار: **${picked}** ✨ — من بين ${options.length} خيارات` });
    },
};
exports.default = command;
//# sourceMappingURL=choose.js.map