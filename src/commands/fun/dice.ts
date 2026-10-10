// ============================================
// Liberty City Bot - Dice Command
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

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

    const embed = new EmbedBuilder()
      .setTitle('🎲 رمية النرد')
      .setColor(Colors.primary)
      .addFields(
        { name: 'الرميات', value: rolls.map(r => `\`${r}\``).join(' • '), inline: true },
        { name: 'الأوجه', value: `\`${sides}\``, inline: true },
        ...(count > 1 ? [{ name: 'المجموع', value: `\`${total}\``, inline: true }] : []),
      )
      .setFooter({ text: `رمتها ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
