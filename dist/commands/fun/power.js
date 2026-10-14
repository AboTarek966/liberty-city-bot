"use strict";
// ============================================
// Liberty City Bot - Power (تدريب القوة)
// ضربة واحدة تقيس قوتك — ويمكنك مواجهة صديق
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const gameUtil_1 = require("../../utils/gameUtil");
const MESSAGES = {
    weak: ['الكيس ما تحرك أصلاً...', 'واضح إنك جعت!', 'ضربة خفيفة 😴'],
    mid: ['الكيس ارجف!', 'قوة مقبولة 💪', 'تحتاج تدريب أكثر'],
    strong: ['الكيس طار! 🔥', 'ضربة قوية جداً!', 'الحائط اهتز'],
    god: ['💥 الكيس انفجر!', 'أسطورة! القاعة كلها اهتزت', 'هذا مستوى احترافي!'],
};
function tier(score) {
    if (score >= 90)
        return 'god';
    if (score >= 70)
        return 'strong';
    if (score >= 40)
        return 'mid';
    return 'weak';
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('power')
        .setDescription('🏋️ تدريب القوة — اضرب الكيس وشوف قوتك!')
        .addUserOption(opt => opt.setName('user').setDescription('واجه صديقاً وقارن قوتكم').setRequired(false))
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        await interaction.deferReply();
        const opponent = interaction.options.getUser('user');
        await interaction.editReply({ content: '🏋️ تستعد للضربة...' }).catch(() => { });
        await (0, gameUtil_1.sleep)(750);
        const mine = Math.floor(Math.random() * 101);
        const myLine = `💥 <@${interaction.user.id}> ضرب لـ **${mine}** — ${(0, gameUtil_1.pick)(MESSAGES[tier(mine)])}`;
        if (!opponent || opponent.bot || opponent.id === interaction.user.id) {
            await interaction.editReply({
                content: `${myLine} • ${(0, gameUtil_1.ratingLine)(mine)}`,
            });
            return;
        }
        await interaction.editReply({ content: `${myLine} • الآن دور الخصم...` }).catch(() => { });
        await (0, gameUtil_1.sleep)(850);
        const theirs = Math.floor(Math.random() * 101);
        const winner = mine === theirs ? null : mine > theirs ? interaction.user : opponent;
        const verdict = winner === null ? '🤝 تعادل مثير!' :
            `🏆 الفائز: <@${winner.id}> (فرق ${Math.abs(mine - theirs)} نقطة)`;
        await interaction.editReply({
            content: `${myLine} | 💥 <@${opponent.id}> ضرب لـ **${theirs}** — ${(0, gameUtil_1.pick)(MESSAGES[tier(theirs)])} • ${verdict}`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=power.js.map