"use strict";
// ============================================
// Liberty City Bot - XO Command (إكس أو — ضد لاعب)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const xoGame_1 = require("../../utils/xoGame");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('xo')
        .setDescription('❌⭕ لعبة XO — تحدَّ عضواً في لعبة إكس أو!')
        .addUserOption(opt => opt.setName('user').setDescription('الخصم').setRequired(true))
        .setDMPermission(false),
    cooldown: 10,
    async execute(interaction) {
        const opponent = interaction.options.getUser('user', true);
        if (opponent.bot) {
            await interaction.reply({ content: '❌ لا يمكنك اللعب ضد بوت', ephemeral: true });
            return;
        }
        if (opponent.id === interaction.user.id) {
            await interaction.reply({ content: '❌ لا يمكنك تحدي نفسك', ephemeral: true });
            return;
        }
        const game = (0, xoGame_1.createXoGame)(interaction.user.id, opponent.id);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embeds_1.Colors.primary)
            .setTitle('❌⭕ تحدي XO!')
            .setDescription(`${interaction.user} يتحدى ${opponent}! • ` +
            `${interaction.user} = **X** (يبدأ أولاً) | ${opponent} = **O**\n` +
            `الأزرار الفارغة قابلة للضغط — اللعبة تنتهي خلال 3 دقائق`);
        await interaction.reply({
            embeds: [embed],
            components: (0, xoGame_1.renderXoBoard)(game),
        });
    },
};
exports.default = command;
//# sourceMappingURL=xo.js.map