"use strict";
// ============================================
// Liberty City Bot - Balance Command (الرصيد)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const helpers_1 = require("../../utils/helpers");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('balance')
        .setDescription('💰 عرض رصيدك — المحفظة والبنك')
        .addUserOption(option => option.setName('user').setDescription('العضو (افتراضياً: أنت)').setRequired(false))
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const profile = await models_1.UserProfile.findOne({
            userId: target.id,
            guildId: interaction.guildId,
        }).catch(() => null);
        const wallet = profile?.balance || 0;
        const bank = profile?.bank || 0;
        await interaction.reply({
            content: `💰 رصيد ${target.username} — 👛 ${(0, helpers_1.formatNumber)(wallet)} • 🏦 ${(0, helpers_1.formatNumber)(bank)} • 📊 ${(0, helpers_1.formatNumber)(wallet + bank)}`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=balance.js.map