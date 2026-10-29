"use strict";
// ============================================
// Liberty City Bot - Bomb (اقطع السلك)
// قنبلة بسلك صحيح واحد — تحديد الرياضيات ينقذك
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const funGameState_1 = require("../../utils/funGameState");
const WIRES = ['🔴', '🔵', '🟢', '🟡'];
function makeSum(want) {
    const a = 1 + Math.floor(Math.random() * Math.max(2, want - 1));
    return `${a} + ${Math.max(1, want - a)}`;
}
function makeWrong(want) {
    for (let i = 0; i < 50; i++) {
        const a = 1 + Math.floor(Math.random() * 15);
        const b = 1 + Math.floor(Math.random() * 15);
        if (a + b !== want)
            return `${a} + ${b}`;
    }
    return '9 + 9';
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('bomb')
        .setDescription('💣 اقطع السلك — أربعة أسلاك وسلك واحد فقط ينقذك!')
        .setDMPermission(false),
    cooldown: 7,
    async execute(interaction) {
        await interaction.deferReply();
        const target = 6 + Math.floor(Math.random() * 18); // 6 .. 23
        const labels = [makeSum(target), makeWrong(target), makeWrong(target), makeWrong(target)];
        // خلط فيشر-يتس ثم تحديد موضع السلك الصحيح من القيم النهائية
        for (let i = labels.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [labels[i], labels[j]] = [labels[j], labels[i]];
        }
        const correct = labels.findIndex(l => {
            const [a, b] = l.split(' + ').map(Number);
            return a + b === target;
        });
        const id = (0, funGameState_1.newGameId)();
        (0, funGameState_1.setFunState)(id, 'bomb', { correct, target, labels, done: false });
        const row = new discord_js_1.ActionRowBuilder().addComponents(labels.map((l, i) => new discord_js_1.ButtonBuilder()
            .setCustomId(`fun:bomb:${id}:${i}`)
            .setLabel(`${WIRES[i]} ${l}`)
            .setStyle(discord_js_1.ButtonStyle.Danger)));
        await interaction.editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.error)
                    .setTitle('💣 قنبلة مسلّحة!')
                    .setDescription(`⏱️ الإشارة الأخيرة قبل الانفجار:\n\n` +
                    `> اقطع السلك الذي مجموعه **= ${target}**\n\n` +
                    `${WIRES.map((w, i) => `${w} \`${labels[i]}\``).join('  •  ')}`)
                    .setFooter({ text: 'اختر بسرعة — أحد الأربعة خطأ وينفجر!' }),
            ],
            components: [row],
        });
    },
};
exports.default = command;
//# sourceMappingURL=bomb.js.map