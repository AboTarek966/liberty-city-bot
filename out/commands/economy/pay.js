"use strict";
// ============================================
// Liberty City Bot - Pay Command (تحويل الرصيد)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const helpers_1 = require("../../utils/helpers");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('pay')
        .setDescription('💸 تحويل رصيد لعضو آخر')
        .addUserOption(option => option.setName('user').setDescription('العضو المستلم').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('المبلغ (1 على الأقل)').setRequired(true).setMinValue(1))
        .setDMPermission(false),
    cooldown: 10,
    async execute(interaction) {
        const target = interaction.options.getUser('user', true);
        const amount = interaction.options.getInteger('amount', true);
        if (target.bot) {
            await interaction.reply({ content: '❌ لا يمكن التحويل لبوت', ephemeral: true });
            return;
        }
        if (target.id === interaction.user.id) {
            await interaction.reply({ content: '❌ لا يمكنك التحويل لنفسك', ephemeral: true });
            return;
        }
        const sender = await models_1.UserProfile.findOne({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        }).catch(() => null);
        if (!sender || sender.balance < amount) {
            await interaction.reply({
                content: `❌ رصيدك غير كافٍ — تحتاج **${(0, helpers_1.formatNumber)(amount)}** ولديك **${(0, helpers_1.formatNumber)(sender?.balance || 0)}**`,
                ephemeral: true,
            });
            return;
        }
        // خصم من المرسل + إضافة للمستلم (upsert)
        sender.balance -= amount;
        await sender.save();
        await models_1.UserProfile.updateOne({ userId: target.id, guildId: interaction.guildId }, { $inc: { balance: amount } }, { upsert: true }).exec();
        await interaction.reply({
            content: `💸 حوّلت **${(0, helpers_1.formatNumber)(amount)}** عملة إلى ${target} • ` +
                `رصيدك الآن: **${(0, helpers_1.formatNumber)(sender.balance)}**`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=pay.js.map