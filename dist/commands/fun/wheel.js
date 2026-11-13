"use strict";
// ============================================
// Omni Bot - Wheel of Fortune (عجلة الحظ)
// دوّر العجلة كصورة متحركة GIF وشوف ماذا تربح!
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const gameUtil_1 = require("../../utils/gameUtil");
const wheelOfFortune_1 = require("../../utils/wheelOfFortune");
const PRIZES = [
    { name: 'جوهرة', weight: 1, line: '🏆 **جاكبوت!** أنت محظوظ اليوم' },
    { name: 'ميدالية ذهبية', weight: 3, line: '🔥 رهيب! جائزة نادرة' },
    { name: 'هدية', weight: 8, line: '🎉 هدية لطيفة' },
    { name: 'تذكرة', weight: 14, line: '🎟️ ربحت تذكرة' },
    { name: 'نجمة', weight: 18, line: '⭐ نقطة حظ' },
    { name: 'عملة', weight: 22, line: '🪙 ربحت خمسة ريالات' },
    { name: 'لا شيء', weight: 20, line: '😅 لا شيء هذه المرة' },
    { name: 'دجاجة', weight: 8, line: '🐔 دجاجة؟ على الأقل شوف!' },
    { name: 'حظ سيء', weight: 6, line: '💀 العجلة سرقت فلوسك' },
];
const PRIZE_COLORS = [
    '#dc2626', '#b45309', '#f59e0b', '#16a34a', '#0ea5e9',
    '#f97316', '#475569', '#db2777', '#7c3aed',
];
/** اختيار موزون يُرجع الفهرس — العجلة ستتوقف على نفس القطعة */
function weightedPickIndex(prizes) {
    const total = prizes.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < prizes.length; i++) {
        roll -= prizes[i].weight;
        if (roll <= 0)
            return i;
    }
    return prizes.length - 1;
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('wheel')
        .setDescription('🍀 عجلة الحظ — دوّرها كصورة متحركة وشوف ماذا تربح!')
        .setDMPermission(false),
    cooldown: 6,
    async execute(interaction) {
        await interaction.deferReply();
        const winIndex = weightedPickIndex(PRIZES);
        const prize = PRIZES[winIndex];
        const segments = PRIZES.map((p, i) => ({
            label: p.name,
            color: PRIZE_COLORS[i % PRIZE_COLORS.length],
        }));
        let gifBuffer = null;
        try {
            gifBuffer = await (0, wheelOfFortune_1.renderWheelOfFortuneGif)({
                title: 'عجلة الحظ',
                subtitle: 'دوّرها... حظّك فين؟',
                segments,
                winnerIndex: winIndex,
                hubText: 'OMNI',
            });
        }
        catch (err) {
            console.warn(`[Wheel] wheel gif failed: ${err?.message || err}`);
        }
        if (gifBuffer) {
            const file = new discord_js_1.AttachmentBuilder(gifBuffer, { name: 'wheel.gif' });
            await interaction.editReply({
                content: `🍀 **عجلة الحظ تدور...** <@${interaction.user.id}> تجهّز؟`,
                files: [file],
            });
            await (0, gameUtil_1.sleep)(2700);
            await interaction.editReply({
                content: `🍀 <@${interaction.user.id}> — النتيجة: **${prize.name}** • ${prize.line}`,
            });
        }
        else {
            await (0, gameUtil_1.sleep)(1200);
            await interaction.editReply({
                content: `🍀 <@${interaction.user.id}> — النتيجة: **${prize.name}** • ${prize.line}`,
            });
        }
    },
};
exports.default = command;
//# sourceMappingURL=wheel.js.map