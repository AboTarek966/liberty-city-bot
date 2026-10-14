"use strict";
// ============================================
// Liberty City Bot - Treasure Chests (صناديق الكنز)
// ثلاثة صناديق — واحد فقط فيه الكنز
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const funGameState_1 = require("../../utils/funGameState");
const CHESTS = ['📦', '🎁', '🗃️'];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('treasure')
        .setDescription('💰 صناديق الكنز — ثلاثة صناديق، كنز واحد، اختر بحكمة!')
        .setDMPermission(false),
    cooldown: 6,
    async execute(interaction) {
        await interaction.deferReply();
        const prizeIdx = Math.floor(Math.random() * CHESTS.length);
        const id = (0, funGameState_1.newGameId)();
        (0, funGameState_1.setFunState)(id, 'treasure', { prizeIdx, taken: false });
        const row = new discord_js_1.ActionRowBuilder().addComponents(CHESTS.map((_, i) => new discord_js_1.ButtonBuilder()
            .setCustomId(`fun:treasure:${id}:${i}`)
            .setLabel(`الصندوق ${i + 1}`)
            .setStyle(discord_js_1.ButtonStyle.Secondary)));
        await interaction.editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.primary)
                    .setTitle('💰 صناديق الكنز')
                    .setDescription('اختر صندوقاً واحداً فقط — **كنز واحد** من الثلاثة!')
                    .setFooter({ text: 'مرة واحدة لكل شخص — الحظ يحسم' }),
            ],
            components: [row],
        });
    },
};
exports.default = command;
//# sourceMappingURL=treasure.js.map