"use strict";
// ============================================
// Omni Bot - ⏹️ إيقاف لعبة الروليت الحالية
// ============================================
// /roulette_stop — يوقف اللعبة الحالية في القناة فوراً ويُعلن نهاية اللعب.
// الصلاحية: ManageGuild (مفيد للقادة) أو مالك السيرفر.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const rouletteGame_1 = require("../../utils/rouletteGame");
const helpers_1 = require("../../utils/helpers");
const botOwner_1 = require("../../utils/botOwner");
const logger = (0, helpers_1.createLogger)('RouletteStop');
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('roulette_stop')
        .setDescription('⏹️ إيقاف لعبة الروليت الحالية في هذه القناة فوراً')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    cooldown: 5,
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.guild) {
            await interaction.editReply({ content: '❌ يعمل في السيرفر فقط.' });
            return;
        }
        const guild = interaction.guild;
        const member = guild.members.cache.get(interaction.user.id);
        const isOwner = guild.ownerId === interaction.user.id || (0, botOwner_1.isEnvBotOwner)(interaction.user.id);
        const hasManage = member?.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild) ?? false;
        if (!isOwner && !hasManage) {
            await interaction.editReply({ content: '⛔ هذا الأمر لمالك السيرفر أو مالك/مطوّر البوت أو من يملك ManageGuild فقط.' });
            return;
        }
        // أبحث عن أي لعبة جارية في هذه القناة
        const targetChannelId = interaction.channelId;
        const game = [...rouletteGame_1.rouletteGames.values()].find((g) => g.channelId === targetChannelId && g.phase !== 'done');
        if (!game) {
            await interaction.editReply({ content: '🫙 لا توجد لعبة روليت جارية في هذه القناة.' });
            return;
        }
        const playersNow = game.players.length;
        try {
            await (0, rouletteGame_1.cleanupStoppedGame)(interaction.client, game);
        }
        catch (err) {
            logger.warn(`cleanupStoppedGame error: ${err?.message || err}`);
            rouletteGame_1.rouletteGames.delete(game.id);
        }
        await interaction.editReply({
            content: `🛑 تم إيقاف لعبة الروليت في هذه القناة — كان متبقاً **${playersNow}** مشارك.`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=rouletteStop.js.map