"use strict";
// ============================================
// Liberty City Bot - Roulette (روليت)
// يختار شخصاً عشوائياً من المذكورين (أو من الأعضاء النشطين)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('roulette')
        .setDescription('🔫 لعبة الروليت — البارودة تدور وتُصيب شخصاً واحداً!')
        .addUserOption(opt => opt.setName('user').setDescription('أول مشارك').setRequired(false))
        .addUserOption(opt => opt.setName('user2').setDescription('مشارك ثانٍ').setRequired(false))
        .addUserOption(opt => opt.setName('user3').setDescription('مشارك ثالث').setRequired(false))
        .addUserOption(opt => opt.setName('user4').setDescription('مشارك رابع').setRequired(false))
        .addUserOption(opt => opt.setName('user5').setDescription('مشارك خامس').setRequired(false))
        .setDMPermission(false),
    cooldown: 8,
    async execute(interaction) {
        await interaction.deferReply();
        // جمع المشاركين (من المنشونات) أو اختيار عشوائي من الأعضاء
        const players = [];
        for (const name of ['user', 'user2', 'user3', 'user4', 'user5']) {
            const u = interaction.options.getUser(name);
            if (u && !u.bot && !players.includes(u.id))
                players.push(u.id);
        }
        if (players.length < 2) {
            const members = interaction.guild.members.cache.filter(m => !m.user.bot);
            const shuffled = shuffleArray(members.map(m => m.id));
            players.length = 0;
            players.push(...shuffled.slice(0, 5));
        }
        if (players.length < 2) {
            await interaction.editReply({ content: '❌يحتاج الروليت شخصين على الأقل' });
            return;
        }
        const lines = players.map(p => `> 🔘 <@${p}>`).join('\n');
        const start = new discord_js_1.EmbedBuilder()
            .setColor(embeds_1.Colors.warning)
            .setTitle('🔫 لعبة الروليت!')
            .setDescription(`**المشاركون:**\n${lines}\n\nالبارودة تدور...`)
            .setTimestamp();
        await interaction.editReply({ embeds: [start] });
        await new Promise(r => setTimeout(r, 1500));
        await interaction.editReply({
            embeds: [start.setFields({ name: '🔊', value: 'جرررررخ...' })],
        }).catch(() => { });
        await new Promise(r => setTimeout(r, 1500));
        const victimId = players[Math.floor(Math.random() * players.length)];
        const survivors = players.filter(p => p !== victimId);
        const result = new discord_js_1.EmbedBuilder()
            .setColor(embeds_1.Colors.error)
            .setTitle('💥 البارودة أصابت!')
            .setDescription(`> 💀 **الضحية:** <@${victimId}>\n\n` +
            `**الناجون:**\n${survivors.map(s => `> ✅ <@${s}>`).join('\n')}\n\n` +
            `_جرّب حظك مرة أخرى!_`)
            .setTimestamp();
        await interaction.editReply({ embeds: [result] });
    },
};
// خلط عشوائي مبسّط
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
exports.default = command;
//# sourceMappingURL=roulette.js.map