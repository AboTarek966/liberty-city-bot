// ============================================
// Liberty City Bot - Rate Command
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('💯 قيّم أي شيء من 0 إلى 100')
    .addStringOption(opt =>
      opt
        .setName('thing')
        .setDescription('الشيء الذي تريد تقييمه')
        .setRequired(true)
        .setMaxLength(200)
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const thing = interaction.options.getString('thing', true);

    // نفس الشيء = نفس التقييم (مميزات ممتعة!)
    let hash = 0;
    for (let i = 0; i < thing.length; i++) {
      hash = (hash * 31 + thing.charCodeAt(i)) >>> 0;
    }
    const score = hash % 101;

    let reaction: string;
    if (score >= 90) reaction = '🌟 مثالي!';
    else if (score >= 70) reaction = '👍 رائع';
    else if (score >= 50) reaction = '😐 متوسط';
    else if (score >= 30) reaction = '😬 يحتاج تحسين';
    else reaction = '💀 كارثة';

    const bar = '🟩'.repeat(Math.round(score / 10)) + '🟥'.repeat(10 - Math.round(score / 10));

    const embed = new EmbedBuilder()
      .setTitle('💯 تقييمي')
      .setColor(Colors.primary)
      .setDescription(`**${thing}**\n\n${bar} **${score}/100** — ${reaction}`)
      .setFooter({ text: `قيّمه ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
