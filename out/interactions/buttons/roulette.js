"use strict";
// ============================================
// Omni Bot - 🔫 أزرار لعبة الروليت (اللوبي + اختيار الطرد)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const rouletteGame_1 = require("../../utils/rouletteGame");
function playerFromMember(member) {
    return {
        id: member.id,
        username: member.user?.username || member.username || 'لاعب',
        avatarUrl: member.displayAvatarURL?.({ extension: 'png', size: 64 }) ||
            member.user?.displayAvatarURL?.({ extension: 'png', size: 64 }),
    };
}
const handler = {
    id: 'roulette',
    async execute(interaction) {
        const parts = interaction.customId.split(':');
        const action = parts[1];
        const gameId = parts[2];
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ تعمل داخل السيرفر فقط', ephemeral: true });
            return;
        }
        const game = gameId ? rouletteGame_1.rouletteGames.get(gameId) : undefined;
        if (!game) {
            await interaction.reply({ content: '❌ هذه اللعبة انتهت أو لم تعد متوفرة.', ephemeral: true });
            return;
        }
        // ========== دخول اللعبة ==========
        if (action === 'join') {
            if (game.phase !== 'lobby') {
                await interaction.reply({ content: '❌ بدأت اللعبة — ممنوع الانضمام الآن.', ephemeral: true });
                return;
            }
            const member = interaction.member;
            const result = (0, rouletteGame_1.addToRouletteLobby)(game.id, playerFromMember(member));
            if (!result.ok) {
                await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
                return;
            }
            await interaction.update({
                embeds: [(0, rouletteGame_1.lobbyEmbed)(game)],
                components: (0, rouletteGame_1.lobbyRow)(game),
            });
            return;
        }
        // ========== 🤖 إضافة بوتات — اختر العدد من قائمة منبثقة ==========
        if (action === 'addbots') {
            if (game.phase !== 'lobby') {
                await interaction.reply({ content: '❌ بدأت اللعبة بالفعل — ممنوع الإضافة الآن.', ephemeral: true });
                return;
            }
            const options = [
                ...Array.from({ length: 8 }, (_, i) => ({ label: `${i + 1} بوت`, value: String(i + 1), emoji: '🤖' })),
                { label: '10 بوتات', value: '10', emoji: '👾' },
                { label: '25 — كل البوتات', value: '25', emoji: '🎉' },
            ];
            const menu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`roulette_bot_count:${gameId}`)
                .setPlaceholder('كم بوت تحب أضيف؟')
                .addOptions(options);
            const row = new discord_js_1.ActionRowBuilder().addComponents(menu);
            await interaction.reply({
                content: '🤖 **اختر عدد البوتات اللي تحب تضيفها للعبة:**',
                components: [row],
                ephemeral: true,
            });
            return;
        }
        // ========== خروج من اللعبة ==========
        if (action === 'leave') {
            if (game.phase !== 'lobby') {
                await interaction.reply({ content: '❌ بدأت اللعبة — الطرد هو الفاصل الوحيد.', ephemeral: true });
                return;
            }
            const result = (0, rouletteGame_1.removeFromRouletteLobby)(game.id, interaction.user.id);
            if (!result.ok) {
                await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
                return;
            }
            await interaction.update({
                embeds: [(0, rouletteGame_1.lobbyEmbed)(game)],
                components: (0, rouletteGame_1.lobbyRow)(game),
            });
            return;
        }
        // ========== اختيار الطرد ==========
        if (action === 'kick') {
            const targetId = parts[3];
            if (!targetId) {
                await interaction.reply({ content: '❌ زر غير صالح.', ephemeral: true });
                return;
            }
            if (game.phase !== 'choosing') {
                await interaction.reply({ content: '❌ مش وقت الاختيار دلوقتي.', ephemeral: true });
                return;
            }
            // فقط اللي اختارته العجلة يقدر يضغط
            if (interaction.user.id !== game.chooserId) {
                await interaction.reply({
                    content: '❌ مش دورك — العجلة اختارت لاعب تاني.',
                    ephemeral: true,
                });
                return;
            }
            const res = await (0, rouletteGame_1.resolveKick)(interaction.client, game, targetId);
            if (!res.ok) {
                await interaction.reply({ content: `❌ ${res.reason}`, ephemeral: true });
                return;
            }
            await interaction.reply({
                content: `🔫 اخترت طرد <@${targetId}> من اللعبة!`,
                ephemeral: true,
            });
            return;
        }
        await interaction.reply({ content: '❌ زر غير معروف.', ephemeral: true });
    },
};
exports.default = handler;
//# sourceMappingURL=roulette.js.map