"use strict";
// ============================================
// Liberty City Bot - 8ball Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ANSWERS = [
    '🔮 بلا شك — نعم!',
    '✨ مؤكد 100%... كلا! (مزحة — نعم!)',
    '😏 الأعراض تشير إلى نعم',
    '🌟 سرّي جداً... لكن البداية بالنعم',
    '✅ نعم قطعاً',
    '❌ لا أعتقد ذلك',
    '🤔 السؤال غامض، جرّب مرة أخرى',
    '⏳ اسأل لاحقاً',
    '🙄 حتى أنا لا أعرف...',
    '🎯 لا شيء على الإطلاق',
    '👌 ممكن جداً',
    '💣 لا، وقطعاً لا!',
    '🍀 حظاً موفقاً — الجواب نعم',
    '⚠️ لا تعتمد على ذلك',
    '🎲 الأرقام تقول نعم',
    '🌀 مازلت متردداً... لعله نعم',
    '🚫 ممنوع الجواب! جرّب سؤالاً آخر',
    '💯 نعم، وأنا متأكد',
    '😈 لا أستطيع أن أقول...',
    '🍀 لا مانع — نعم!',
];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('8ball')
        .setDescription('🎱 كرة السحر — اسأل وستجيب لك')
        .addStringOption(opt => opt
        .setName('question')
        .setDescription('سؤالك (ابدأ بـ هل، هل يمكن، هل سـ...)')
        .setRequired(true)
        .setMaxLength(300)),
    cooldown: 5,
    async execute(interaction) {
        const question = interaction.options.getString('question', true);
        if (!/\?|؟|هل|ماذا|متى|أين|كيف|من|كم/.test(question)) {
            await interaction.reply({
                content: '🎱 الكرة السحرية تحتاج سؤالاً! (ابدأ بـ **هل...؟**)',
                ephemeral: true,
            });
            return;
        }
        // إزالة نصوص مكسورة سابقة
        const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🎱 كرة السحر')
            .setColor(0x1A1A2E)
            .addFields({ name: '❓ سؤالك', value: question.substring(0, 300), inline: false }, { name: '🔮 الإجابة', value: answer, inline: false })
            .setFooter({ text: `سأله ${interaction.user.username}` })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=eightball.js.map