"use strict";
// ============================================
// Omni Bot - 🤖 اختيار عدد البوتات في الروليت
// roulette_bot_count:<gameId> — اللعبة تنشئ N بوت بأسماء يخترعها البوت
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const rouletteGame_1 = require("../../utils/rouletteGame");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('RouletteBots');
const handler = {
    id: 'roulette_bot_count',
    async execute(interactionRaw) {
        const interaction = interactionRaw;
        const gameId = interaction.customId.slice('roulette_bot_count:'.length);
        const game = rouletteGame_1.rouletteGames.get(gameId);
        if (!game) {
            await interaction.update({
                content: '❌ اللعبة انتهت أو غير متاحة — ابدأ واحدة تانية.',
                components: [],
            });
            return;
        }
        if (game.phase !== 'lobby') {
            await interaction.update({
                content: '❌ بدأت اللعبة بالفعل — ممنوع الإضافة الآن.',
                components: [],
            });
            return;
        }
        const count = parseInt(interaction.values[0] || '0', 10);
        const added = (0, rouletteGame_1.inventPlayersForGame)(count, game.players);
        if (added.length === 0) {
            await interaction.update({
                content: '❌ اللعبة ممتلئة (25 لاعب) — ما أقدر أضيف أكتر من كده.',
                components: [],
            });
            return;
        }
        game.players.push(...added);
        // حدّث رسالة اللوبي العامة بكل اللاعبين الجدد
        try {
            const ch = interaction.channel;
            if (game.messageId && ch?.messages?.fetch) {
                const msg = await ch.messages.fetch(game.messageId).catch(() => null);
                if (msg)
                    await msg.edit({ embeds: [(0, rouletteGame_1.lobbyEmbed)(game)], components: (0, rouletteGame_1.lobbyRow)(game) });
            }
        }
        catch (err) {
            logger.warn(`lobby update failed: ${err?.message || err}`);
        }
        const names = added.map((p) => p.username).join('، ');
        await interaction.update({
            content: `🤖 أضفت **${added.length}** لاعب وهمي للعجلة:\n${names}`,
            components: [],
        });
    },
};
exports.default = handler;
//# sourceMappingURL=rouletteBotCount.js.map