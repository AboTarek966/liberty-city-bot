// ============================================
// Liberty City Bot - Rock Paper Scissors (حجر ورقة مقص)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';

const CHOICES: Record<string, { name: string; emoji: string; beats: string }> = {
  حجر: { name: 'حجر', emoji: '🪨', beats: 'مقص' },
  ورقة: { name: 'ورقة', emoji: '📄', beats: 'حجر' },
  مقص: { name: 'مقص', emoji: '✂️', beats: 'ورقة' },
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('🪨📄✂️ حجر ورقة مقص — ضد البوت!')
    .addStringOption(opt =>
      opt
        .setName('choice')
        .setDescription('اختيارك')
        .setRequired(true)
        .addChoices(
          { name: '🪨 حجر', value: 'حجر' },
          { name: '📄 ورقة', value: 'ورقة' },
          { name: '✂️ مقص', value: 'مقص' }
        )
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const player = interaction.options.getString('choice', true);
    const keys = Object.keys(CHOICES);
    const bot = keys[Math.floor(Math.random() * keys.length)];

    let title: string;
    let color: ColorResolvable;
    if (player === bot) {
      title = '🤝 تعادل!';
      color = Colors.warning;
    } else if (CHOICES[player].beats === bot) {
      title = '🎉 فزت!';
      color = Colors.success;
    } else {
      title = '💀 البوت فاز!';
      color = Colors.error;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(title)
          .setDescription(
            `**أنت:** ${CHOICES[player].emoji} ${CHOICES[player].name}\n` +
            `**البوت:** ${CHOICES[bot].emoji} ${CHOICES[bot].name}\n\n` +
            `_جولة جديدة؟ اكتب الأمر مرة أخرى!_`
          )
          .setTimestamp(),
      ],
    });
  },
};

export default command;
