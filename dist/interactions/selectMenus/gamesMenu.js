"use strict";
// ============================================
// Liberty City Bot - Games Menu Handler
// اختيار لعبة من القائمة → إرسال طريقة اللعب
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const games_1 = require("../../commands/fun/games");
const handler = {
    id: 'games_menu',
    async execute(interactionRaw) {
        const interaction = interactionRaw;
        await interaction.deferUpdate(); // ✅ فوراً
        const game = games_1.GAMES_LIST.find(g => g.value === interaction.values[0]);
        if (!game) {
            await interaction.followUp({ content: '❌ لعبة غير معروفة', ephemeral: true });
            return;
        }
        await interaction.followUp({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.primary)
                    .setTitle(`${game.label} — طريقة اللعب`)
                    .setDescription(`\`\`\`\n${game.usage}\n\`\`\``)
                    .setFooter({ text: 'اكتب الأمر كما هو — وجرّب حظك!' }),
            ],
            ephemeral: true,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=gamesMenu.js.map