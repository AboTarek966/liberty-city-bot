"use strict";
// ============================================
// Liberty City Bot - Blackjack (بلك جاك)
// ضد الموزع — اسحب أو قف، 21 هو الرقم السحري
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const funGameState_1 = require("../../utils/funGameState");
const blackjack_1 = require("../../utils/blackjack");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('🃏 بلك جاك — اسحب أو قف، اقترب من 21 دون أن تتجاوز!')
        .setDMPermission(false),
    cooldown: 8,
    async execute(interaction) {
        await interaction.deferReply();
        const deck = (0, blackjack_1.newDeck)();
        const player = [deck.pop(), deck.pop()];
        const dealer = [deck.pop(), deck.pop()];
        const id = (0, funGameState_1.newGameId)();
        (0, funGameState_1.setFunState)(id, 'bj', { deck, player, dealer, done: false }, 3 * 60 * 1000);
        // بلك جاك فوري؟
        if ((0, blackjack_1.handValue)(player) === 21) {
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(embeds_1.Colors.success)
                        .setTitle('🃏 بلك جاك!')
                        .setDescription(`✋ يدك: **${(0, blackjack_1.renderHand)(player)} = 21**\n` +
                        `🎩 يد الموزع: **${(0, blackjack_1.renderHand)(dealer)} = ${(0, blackjack_1.handValue)(dealer)}**\n\n` +
                        `🏆 **بلك جاك!** فزت فوراً — ${interaction.user.toString()}!`),
                ],
                components: [],
            });
            return;
        }
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`fun:bj:${id}:hit`).setLabel('🎲 سحب بطاقة').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`fun:bj:${id}:stand`).setLabel('✋ قف').setStyle(discord_js_1.ButtonStyle.Secondary));
        await interaction.editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.primary)
                    .setTitle('🃏 بلك جاك — دورك')
                    .setDescription(`✋ يدك: **${(0, blackjack_1.renderHand)(player)} = ${(0, blackjack_1.handValue)(player)}**\n` +
                    `🎩 يد الموزع: **${(0, blackjack_1.renderHand)(dealer, true)} = ?**\n\n` +
                    `اجمع **21** أو اقترب منها — تجاوزها وخسرت.`),
            ],
            components: [row],
        });
    },
};
exports.default = command;
//# sourceMappingURL=blackjack.js.map