"use strict";
// ============================================
// Liberty City Bot - Leaderboard Buttons
// customId: lb|<type>|<period>|<limit>|<page>[|<mark>]
//   mark: prev / next / r (تحديث) / p (فترة) / t (نوع)
// التنسيق القديم (بدون صفحة) يُعامَل كصفحة 1
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const leaderboard_1 = require("../../commands/utility/leaderboard");
const handler = {
    id: 'lb',
    async execute(interaction) {
        // ✅ الرد السريع فوراً لمنع انتهاء صلاحية التفاعل (خطأ 10062)
        await interaction.deferUpdate();
        const parts = interaction.customId.split('|');
        const type = (0, leaderboard_1.sanitizeType)(parts[1]);
        const period = (0, leaderboard_1.sanitizePeriod)(parts[2]);
        const limit = (0, leaderboard_1.sanitizeLimit)(parts[3]);
        // التنسيق القديم = صفحة 1
        const rawPage = parseInt(parts[4], 10);
        let page = Number.isFinite(rawPage) ? rawPage : 1;
        const mark = parts[5] || '';
        if (mark === 'prev')
            page -= 1;
        else if (mark === 'next')
            page += 1;
        const client = interaction.client;
        // (تجميع الصفوف ثم تقسيمها إلى صفحات يتم داخل الباني،
        //  ورقم الصفحة يُصحَّح تلقائياً إذا تجاوز الإجمالي)
        const result = await (0, leaderboard_1.buildLeaderboardPage)(client, interaction.guild, type, period, limit, page);
        await interaction.editReply({
            embeds: [result.embed],
            components: result.components,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=leaderboard.js.map