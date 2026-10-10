// ============================================
// Liberty City Bot - Flip Command
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('flip')
    .setDescription('🪙 اقلب العملة — كتابة أم وجه؟'),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const isHeads = Math.random() < 0.5;

    await interaction.reply({
      content: isHeads
        ? `🪙 **الوجه!** — العملة سقطت على الوجه 😏`
        : `✍️ **الكتابة!** — العملة سقطت على الكتابة ✨`,
    });
  },
};

export default command;
