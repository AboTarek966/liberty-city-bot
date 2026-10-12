"use strict";
// ============================================
// Liberty City Bot - High / Low (أعلى أم أقل)
// بطاقة مخفية — خمن أعلى أو أقل من رقم البوت
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('highlow')
        .setDescription('🎴 لعبة أعلى/أقل — خمن قيمة بطاقة البوت (فوز ×2)')
        .addIntegerOption(opt => opt.setName('amount').setDescription('مبلغ الرهان').setRequired(true).setMinValue(10).setMaxValue(100000))
        .addStringOption(opt => opt
        .setName('guess')
        .setDescription('تخمينك')
        .setRequired(true)
        .addChoices({ name: '📈 أعلى (High)', value: 'high' }, { name: '📉 أقل (Low)', value: 'low' }))
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount', true);
        const guess = interaction.options.getString('guess', true);
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const profile = await models_1.UserProfile.findOne({ userId, guildId }).catch(() => null);
        if (!profile || profile.balance < amount) {
            await interaction.reply({
                content: `❌ رصيدك غير كافٍ — لديك **${(0, helpers_1.formatNumber)(profile?.balance || 0)}** ورهانك **${(0, helpers_1.formatNumber)(amount)}**`,
                ephemeral: true,
            });
            return;
        }
        const mine = 2 + Math.floor(Math.random() * 10); // 2-11
        const botCard = 2 + Math.floor(Math.random() * 10);
        profile.balance -= amount;
        let won = false;
        if (mine !== botCard) {
            won = guess === 'high' ? botCard > mine : botCard < mine;
        }
        if (won) {
            profile.balance += amount * 2;
        }
        await profile.save();
        await interaction.reply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(won ? embeds_1.Colors.success : mine === botCard ? embeds_1.Colors.warning : embeds_1.Colors.error)
                    .setTitle(won ? '🎉 ربحت!' : mine === botCard ? '🤝 تعادل (نفس الرقم)' : '💀 خسرت')
                    .setDescription(`> **بطاقتك:** \`${mine}\`\n> **بطاقة البوت:** \`${botCard}\`\n\n` +
                    `**الرهان:** \`${(0, helpers_1.formatNumber)(amount)}\` — **الربح:** \`${(0, helpers_1.formatNumber)(won ? amount * 2 : 0)}\`\n` +
                    `**رصيدك:** \`${(0, helpers_1.formatNumber)(profile.balance)}\``)
                    .setTimestamp(),
            ],
        });
    },
};
exports.default = command;
//# sourceMappingURL=highlow.js.map