// ============================================
// Liberty City Bot - Dice Command
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('🎲 ارمِ النرد — كم تحصل؟')
    .addIntegerOption(opt =>
      opt
        .setName('sides')
        .setDescription('عدد أوجه النرد (الافتراضي 6)')
        .setMinValue(2)
        .setMaxValue(100)
    )
    .addIntegerOption(opt =>
      opt
        .setName('count')
        .setDescription('عدد النردات (الافتراضي 1)')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const count = interaction.options.getInteger('count') || 1;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((a, b) => a + b, 0);

    await interaction.reply({
      content:
        `🎲 رمية النرد: ${rolls.map(r => `\`${r}\``).join(' • ')} • الأوجه: \`${sides}\`` +
        (count > 1 ? ` • المجموع: \`${total}\`` : ''),
    });
  },
};

export default command;
