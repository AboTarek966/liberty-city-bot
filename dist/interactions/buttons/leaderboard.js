"use strict";
// ============================================
// Liberty City Bot - Leaderboard Buttons
// customId format: lb|<type>|<period>|<limit>
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const leaderboard_1 = require("../../commands/utility/leaderboard");
const VALID_TYPES = ['all', 'messages', 'voiceMinutes'];
const VALID_PERIODS = ['day', 'week', 'month', 'total'];
const VALID_LIMITS = ['10', '25', 'all'];
const handler = {
    id: 'lb',
    async execute(interaction) {
        // ✅ الرد السريع فوراً لمنع انتهاء صلاحية التفاعل (خطأ 10062)
        await interaction.deferUpdate();
        const parts = interaction.customId.split('|');
        const type = (VALID_TYPES.includes(parts[1]) ? parts[1] : 'all');
        const period = (VALID_PERIODS.includes(parts[2]) ? parts[2] : 'week');
        const limit = (VALID_LIMITS.includes(parts[3]) ? parts[3] : '10');
        const client = interaction.client;
        const embed = await (0, leaderboard_1.buildLeaderboardEmbed)(client, interaction.guildId, type, period, limit);
        const components = (0, leaderboard_1.buildLeaderboardButtons)(type, period, limit);
        await interaction.editReply({ embeds: [embed], components });
    },
};
exports.default = handler;
//# sourceMappingURL=leaderboard.js.map