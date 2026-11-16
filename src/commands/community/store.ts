// ============================================
// Omni Bot - 🛍️ متجر البروجيكتات
// اختر بروجيكت واشتري بالكريديت عبر ProBot
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getStore, buildStoreEmbed, buildStoreSelect } from '../../utils/store';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('store')
    .setDescription('🛍️ متجر البروجيكتات — اختر بروجيكت واشتري بالكريديت عبر ProBot')
    .setDMPermission(false),

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

    const components = buildStoreSelect(store) ?? [];
    const embed = buildStoreEmbed(store);

    await interaction.reply({ embeds: [embed], components });
  },
};

export default command;
