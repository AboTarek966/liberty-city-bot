// ============================================
// Omni Bot - 🛍️ متجر Omni
// بروجيكتات • بوتات • أدوات • رتب • خدمات — الدفع بالكريديت عبر ProBot
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import {
  getStore,
  buildStoreEmbed,
  buildStoreComponents,
  STORE_TYPE_CHOICES,
  normalizeStoreFilter,
} from '../../utils/store';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('store')
    .setDescription('🛍️ متجر Omni — بروجيكتات وبوتات وأدوات ورتب وخدمات بالكريديت')
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('افتح المتجر على قسم معيّن (اختياري)')
        .setRequired(false)
        .addChoices(...STORE_TYPE_CHOICES)
    ),

  cooldown: 3,
  // 🚦 لا يُسجل عالمياً: حد ديسكورد 100 أمر — مثل /dismiss يُسجل لكل سيرفر
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const store = await getStore();
    if (!store) {
      await interaction.reply({
        content: '❌ تعذر فتح المتجر حالياً — حاول مرة أخرى لاحقاً',
        ephemeral: true,
      });
      return;
    }

    const type = interaction.options.getString('type') || 'all';
    const view = { type: normalizeStoreFilter(type), page: 0 };
    const components = buildStoreComponents(store, view);
    const embed = buildStoreEmbed(store, view);

    await interaction.reply({ embeds: [embed], components });
  },
};

export default command;
