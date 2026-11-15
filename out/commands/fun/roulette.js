"use strict";
// ============================================
// Omni Bot - Roulette (روليت) — لعبة جماعية تفاعلية
// /roulette → زر دخول + زر خروج، بعد 60 ثانية تبدأ، والعجلة تدور كل جولة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const rouletteGame_1 = require("../../utils/rouletteGame");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('Roulette');
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('roulette')
        .setDescription('🔫 لعبة روليت جماعية — انضم للعبة، العجلة بتلف، واللي تقف عليه يطرد!')
        .setDMPermission(false),
    cooldown: 10,
    async execute(interaction) {
        await interaction.deferReply();
        // منع تكرار لوبي نشط في نفس القناة
        for (const g of rouletteGame_1.rouletteGames.values()) {
            if (g.channelId === interaction.channelId && g.phase !== 'done') {
                await interaction.editReply({ content: '⚠️ في لعبة روليت شغالة بالفعل في هذه القناة — انتظر حتى تنتهي.' });
                return;
            }
        }
        const gameId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
            .toString(36)
            .padStart(2, '0')}`;
        const game = {
            id: gameId,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            phase: 'lobby',
            players: [],
            avatarBuffers: [],
            chooserId: undefined,
            choiceMessageId: undefined,
            choiceTimer: undefined,
            startTimer: undefined,
            messageId: undefined,
        };
        rouletteGame_1.rouletteGames.set(gameId, game);
        // عد تنازلي — 60 ثانية ثم تُبنى اللعبة
        const timer = setTimeout(() => {
            void (0, rouletteGame_1.startRouletteGame)(interaction.client, gameId);
        }, 60_000);
        game.startTimer = timer;
        const player0 = {
            id: interaction.user.id,
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 64 }),
        };
        game.players.push(player0);
        const message = await interaction.editReply({
            embeds: [(0, rouletteGame_1.lobbyEmbed)(game)],
            components: (0, rouletteGame_1.lobbyRow)(game),
        });
        game.messageId = message?.id;
        logger.info(`Roulette lobby created ${gameId} by ${interaction.user.tag} (${game.players.length} players)`);
    },
};
exports.default = command;
//# sourceMappingURL=roulette.js.map