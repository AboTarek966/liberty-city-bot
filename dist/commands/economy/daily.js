"use strict";
// ============================================
// Liberty City Bot - Daily Command (المكافأة اليومية)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const DAILY_MIN = 100;
const DAILY_MAX = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('daily')
        .setDescription('🎁 استلام مكافأتك اليومية (مرة كل 24 ساعة)')
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        let profile = await models_1.UserProfile.findOne({ userId, guildId }).catch(() => null);
        if (!profile) {
            profile = new models_1.UserProfile({ userId, guildId });
        }
        const now = Date.now();
        if (profile.lastDaily && now - profile.lastDaily.getTime() < DAY_MS) {
            const remaining = profile.lastDaily.getTime() + DAY_MS - now;
            const hours = Math.floor(remaining / 3600_000);
            const minutes = Math.ceil((remaining % 3600_000) / 60_000);
            await interaction.reply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(embeds_1.Colors.warning)
                        .setTitle('⏳ المكافأة اليومية مستخدمة')
                        .setDescription(`جرّب مرة أخرى بعد **${hours}س ${minutes}د**`)
                        .setTimestamp(),
                ],
                ephemeral: true,
            });
            return;
        }
        const reward = Math.floor(Math.random() * (DAILY_MAX - DAILY_MIN + 1)) + DAILY_MIN;
        profile.balance += reward;
        profile.lastDaily = new Date();
        await profile.save();
        await interaction.reply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.success)
                    .setTitle('🎁 تم استلام مكافأتك اليومية!')
                    .setDescription(`حصلت على **${(0, helpers_1.formatNumber)(reward)}** عملة 💰\n` +
                    `رصيدك الآن: **${(0, helpers_1.formatNumber)(profile.balance)}**\n\n` +
                    `🛍️ تفقد المتجر: \`/shop\``)
                    .setTimestamp(),
            ],
        });
    },
};
exports.default = command;
//# sourceMappingURL=daily.js.map