"use strict";
// ============================================
// Liberty City Bot - Slots (ماكينة الحظ)
// رهان من الرصيد — ثلاث نفسية = فوز ×5
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const SYMBOLS = ['🍒', '🍋', '💎', '🔔', '⭐', '7️⃣'];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('slots')
        .setDescription('🎰 ماكينة الحظ — اختر رهانك واربح (ثلاث نفسية = ×5!)')
        .addIntegerOption(opt => opt.setName('amount').setDescription('مبلغ الرهان').setRequired(true).setMinValue(10).setMaxValue(100000))
        .setDMPermission(false),
    cooldown: 6,
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount', true);
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
        profile.balance -= amount;
        const spin = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const a = spin(), b = spin(), c = spin();
        let title;
        let color;
        let payout = 0;
        if (a === b && b === c) {
            payout = amount * 5;
            title = '💎💎💎 جاكبوت! ثلاث نفسية — ربحت ×5!';
            color = embeds_1.Colors.success;
        }
        else if (a === b || b === c || a === c) {
            payout = amount * 2;
            title = '🎉 زوجان! ربحت ×2';
            color = embeds_1.Colors.success;
        }
        else {
            title = '💀 حظ أوفر هذه المرة';
            color = embeds_1.Colors.error;
        }
        profile.balance += payout;
        await profile.save();
        await interaction.reply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(color)
                    .setTitle('🎰 ماكينة الحظ')
                    .setDescription(`> │ ${a} │ ${b} │ ${c} │\n\n` +
                    `${title}\n\n` +
                    `**الرهان:** \`${(0, helpers_1.formatNumber)(amount)}\` — **الربح:** \`${(0, helpers_1.formatNumber)(payout)}\`\n` +
                    `**رصيدك:** \`${(0, helpers_1.formatNumber)(profile.balance)}\``)
                    .setTimestamp(),
            ],
        });
    },
};
exports.default = command;
//# sourceMappingURL=slots.js.map