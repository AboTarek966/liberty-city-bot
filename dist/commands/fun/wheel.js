"use strict";
// ============================================
// Omni Bot - Wheel of Fortune (عجلة الحظ)
// دوّر العجلة كصورة متحركة GIF وشوف ماذا تربح!
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const gameUtil_1 = require("../../utils/gameUtil");
const wheelWorker_1 = require("../../utils/wheelWorker");
const PRIZES = [
    { name: 'جوهرة', wheel: 'DIAMOND', weight: 1, line: '🏆 **جاكبوت!** أنت محظوظ اليوم' },
    { name: 'ميدالية ذهبية', wheel: 'GOLD', weight: 3, line: '🔥 رهيب! جائزة نادرة' },
    { name: 'هدية', wheel: 'GIFT', weight: 8, line: '🎉 هدية لطيفة' },
    { name: 'تذكرة', wheel: 'TICKET', weight: 14, line: '🎟️ ربحت تذكرة' },
    { name: 'نجمة', wheel: 'STAR', weight: 18, line: '⭐ نقطة حظ' },
    { name: 'عملة', wheel: 'COIN', weight: 22, line: '🪙 ربحت خمسة ريالات' },
    { name: 'لا شيء', wheel: 'NOTHING', weight: 20, line: '😅 لا شيء هذه المرة' },
    { name: 'دجاجة', wheel: 'CHICKEN', weight: 8, line: '🐔 دجاجة؟ على الأقل شوف!' },
    { name: 'حظ سيء', wheel: 'BAD LUCK', weight: 6, line: '💀 العجلة سرقت فلوسك' },
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
            label: p.wheel,
            color: PRIZE_COLORS[i % PRIZE_COLORS.length],
        }));
        let gifBuffer = null;
        try {
            // الرندر داخل Worker — GIF لا يتجمّد البوت ولا يستهلك خيطه الرئيسي
            gifBuffer = await (0, wheelWorker_1.renderWheelInWorker)({
                title: 'WHEEL OF FATE',
                subtitle: 'SPIN TO WIN',
                segments,
                winnerIndex: winIndex,
                hubText: 'OMNI',
                format: 'gif',
                resultLabel: 'WINNER',
            }, 25000);
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