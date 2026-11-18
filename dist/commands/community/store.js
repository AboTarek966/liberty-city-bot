"use strict";
// ============================================
// Omni Bot - 🛍️ متجر Omni
// بروجيكتات • بوتات • أدوات • رتب • خدمات — الدفع بالكريديت عبر ProBot
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('store')
        .setDescription('🛍️ متجر Omni — بروجيكتات وبوتات وأدوات ورتب وخدمات بالكريديت')
        .setDMPermission(false)
        .addStringOption((o) => o
        .setName('type')
        .setDescription('افتح المتجر على قسم معيّن (اختياري)')
        .setRequired(false)
        .addChoices(...store_1.STORE_TYPE_CHOICES)),
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
        const type = interaction.options.getString('type') || 'all';
        const view = { type: (0, store_1.normalizeStoreFilter)(type), page: 0 };
        const components = (0, store_1.buildStoreComponents)(store, view);
        const embed = (0, store_1.buildStoreEmbed)(store, view);
        await interaction.reply({ embeds: [embed], components });
    },
};
exports.default = command;
//# sourceMappingURL=store.js.map