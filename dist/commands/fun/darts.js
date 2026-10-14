"use strict";
// ============================================
// Liberty City Bot - Darts (رمي السهم)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const gameUtil_1 = require("../../utils/gameUtil");
/** رمية واحدة على لوح السهم — الوزن يحاكي المسافة عن المركز */
function throwDart() {
    const r = Math.random();
    if (r < 0.06)
        return { score: 50, label: '🎯 في القلب!' };
    if (r < 0.16)
        return { score: 25, label: '🎯 بول خارجي' };
    const n = 1 + Math.floor(Math.random() * 20);
    if (r < 0.34)
        return { score: n * 3, label: `×3 → ${n}` };
    if (r < 0.56)
        return { score: n * 2, label: `×2 → ${n}` };
    return { score: n, label: `${n}` };
}
const ATTEMPTS = 3;
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('darts')
        .setDescription('🎯 رمي السهم — ثلاث رميات، من يصل إلى القلب؟')
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        await interaction.deferReply();
        const rounds = [];
        let total = 0;
        for (let i = 0; i < ATTEMPTS; i++) {
            await interaction.editReply({ content: `🎯 الرمية ${i + 1}/${ATTEMPTS}... ${rounds.join(' | ') || ''}` }).catch(() => { });
            await (0, gameUtil_1.sleep)(750);
            const d = throwDart();
            total += d.score;
            rounds.push(`${d.label} = **${d.score}**`);
        }
        await interaction.editReply({
            content: `🎯 <@${interaction.user.id}> — ${rounds.join(' | ')} • ` +
                `المجموع: **${total}** • ${(0, gameUtil_1.ratingLine)(Math.round((total / 200) * 100))}`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=darts.js.map