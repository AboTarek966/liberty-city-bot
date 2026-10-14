"use strict";
// ============================================
// Liberty City Bot - Wheel of Fortune (عجلة الحظ)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const gameUtil_1 = require("../../utils/gameUtil");
const PRIZES = [
    { emoji: '💎', name: 'جوهرة', weight: 1, line: '🏆 **جاكبوت!** أنت محظوظ اليوم' },
    { emoji: '🥇', name: 'ميدالية ذهبية', weight: 3, line: '🔥 رهيب! جائزة نادرة' },
    { emoji: '🎁', name: 'هدية', weight: 8, line: '🎉 هدية لطيفة' },
    { emoji: '🎟️', name: 'تذكرة', weight: 14, line: '🎟️ ربحت تذكرة' },
    { emoji: '⭐', name: 'نجمة', weight: 18, line: '⭐ نقطة حظ' },
    { emoji: '🪙', name: 'عملة', weight: 22, line: '🪙 ربحت خمسة ريالات' },
    { emoji: '💤', name: 'لا شيء', weight: 20, line: '😅 لا شيء هذه المرة' },
    { emoji: '🐔', name: 'دجاجة', weight: 8, line: '🐔 دجاجة؟ على الأقل شوف!' },
    { emoji: '😵', name: 'حظ سيء', weight: 6, line: '💀 العجلة سرقت فلوسك' },
];
const SPINNER = ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('wheel')
        .setDescription('🍀 عجلة الحظ — دوّرها وشوف ماذا تربح!')
        .setDMPermission(false),
    cooldown: 6,
    async execute(interaction) {
        await interaction.deferReply();
        const prize = (0, gameUtil_1.weightedPick)(PRIZES);
        // تدوير متحرك — العجلة تتباطأ قبل النتيجة
        for (let i = 0; i < 7; i++) {
            const s = SPINNER[Math.floor(Math.random() * SPINNER.length)];
            await interaction.editReply({ content: `🍀 العجلة تدور... ${s} ${s} ${s}` }).catch(() => { });
            await (0, gameUtil_1.sleep)(450 + i * 130);
        }
        await interaction.editReply({
            content: `🍀 <@${interaction.user.id}> — النتيجة: ${prize.emoji} **${prize.name}** • ${prize.line}`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=wheel.js.map