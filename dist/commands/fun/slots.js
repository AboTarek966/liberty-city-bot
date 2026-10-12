"use strict";
// ============================================
// Liberty City Bot - Slots (ماكينة الحظ)
// رهان من الرصيد — ثلاث نفسية = فوز ×5
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
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
        let payout = 0;
        if (a === b && b === c) {
            payout = amount * 5;
            title = '💎💎💎 جاكبوت! ثلاث نفسية — ربحت ×5!';
        }
        else if (a === b || b === c || a === c) {
            payout = amount * 2;
            title = '🎉 زوجان! ربحت ×2';
        }
        else {
            title = '💀 حظ أوفر هذه المرة';
        }
        profile.balance += payout;
        await profile.save();
        await interaction.reply({
            content: `🎰 │ ${a} │ ${b} │ ${c} │ — ${title} • ` +
                `الرهان: \`${(0, helpers_1.formatNumber)(amount)}\` • الربح: \`${(0, helpers_1.formatNumber)(payout)}\` • ` +
                `رصيدك: \`${(0, helpers_1.formatNumber)(profile.balance)}\``,
        });
    },
};
exports.default = command;
//# sourceMappingURL=slots.js.map