"use strict";
// ============================================
// Liberty City Bot - Rock Paper Scissors (حجر ورقة مقص)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const CHOICES = {
    حجر: { name: 'حجر', emoji: '🪨', beats: 'مقص' },
    ورقة: { name: 'ورقة', emoji: '📄', beats: 'حجر' },
    مقص: { name: 'مقص', emoji: '✂️', beats: 'ورقة' },
};
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('rps')
        .setDescription('🪨📄✂️ حجر ورقة مقص — ضد البوت!')
        .addStringOption(opt => opt
        .setName('choice')
        .setDescription('اختيارك')
        .setRequired(true)
        .addChoices({ name: '🪨 حجر', value: 'حجر' }, { name: '📄 ورقة', value: 'ورقة' }, { name: '✂️ مقص', value: 'مقص' }))
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        const player = interaction.options.getString('choice', true);
        const keys = Object.keys(CHOICES);
        const bot = keys[Math.floor(Math.random() * keys.length)];
        let title;
        if (player === bot) {
            title = '🤝 تعادل!';
        }
        else if (CHOICES[player].beats === bot) {
            title = '🎉 فزت!';
        }
        else {
            title = '💀 البوت فاز!';
        }
        await interaction.reply({
            content: `${title} • أنت: ${CHOICES[player].emoji} ${CHOICES[player].name} • ` +
                `البوت: ${CHOICES[bot].emoji} ${CHOICES[bot].name}`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=rps.js.map