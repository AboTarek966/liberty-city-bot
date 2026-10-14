"use strict";
// ============================================
// Liberty City Bot - Bowling (بولينغ)
// ثلاث كرات لكسر كل الأعمدة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const gameUtil_1 = require("../../utils/gameUtil");
const ROLLS = 3;
const PINS = 10;
function pinsLine(down) {
    return '🔵'.repeat(down) + '⚪'.repeat(PINS - down);
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('bowling')
        .setDescription('🎳 بولينغ — ثلاث كرات لكسر الأعمدة العشرة!')
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        await interaction.deferReply();
        let down = 0;
        const log = [];
        await interaction.editReply({ content: `🎳 الملعب: ${pinsLine(0)}` }).catch(() => { });
        for (let roll = 1; roll <= ROLLS && down < PINS; roll++) {
            await (0, gameUtil_1.sleep)(800);
            const remaining = PINS - down;
            const knocked = Math.floor(Math.random() * (remaining + 1));
            down += knocked;
            const note = knocked === 10 ? ' **سترايك!**' :
                knocked === 0 ? ' أخطأ تماماً' : '';
            log.push(`كرة ${roll}: ${knocked}${note}`);
            await interaction.editReply({
                content: `🎳 ${log.join(' | ')} • ${pinsLine(down)}`,
            }).catch(() => { });
        }
        const perfect = down === PINS;
        await interaction.editReply({
            content: `🎳 <@${interaction.user.id}> — ${log.join(' | ')} • ` +
                `الأعمدة: **${down}/${PINS}** • ${perfect ? '🏆 كلها وقعت!' : (0, gameUtil_1.ratingLine)(down * 10)}`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=bowling.js.map