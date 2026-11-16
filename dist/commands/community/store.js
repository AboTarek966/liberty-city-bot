"use strict";
// ============================================
// Omni Bot - 🛍️ متجر البروجيكتات
// اختر بروجيكت واشتري بالكريديت عبر ProBot
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('store')
        .setDescription('🛍️ متجر البروجيكتات — اختر بروجيكت واشتري بالكريديت عبر ProBot')
        .setDMPermission(false),
    cooldown: 3,
    // 🚦 لا يُسجل عالمياً: حد ديسكورد 100 أمر — مثل /dismiss يُسجل لكل سيرفر
    guildOnly: true,
    async execute(interaction) {
        const store = await (0, store_1.getStore)();
        if (!store) {
            await interaction.reply({
                content: '❌ تعذر فتح المتجر حالياً — حاول مرة أخرى لاحقاً',
                ephemeral: true,
            });
            return;
        }
        const components = (0, store_1.buildStoreSelect)(store) ?? [];
        const embed = (0, store_1.buildStoreEmbed)(store);
        await interaction.reply({ embeds: [embed], components });
    },
};
exports.default = command;
//# sourceMappingURL=store.js.map