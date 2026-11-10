// ============================================
// Omni Bot - Giveaway Participants List Button
// ============================================
// يفتح قائمة كل المشاركين في السحب (مؤقتة ومرئية لمن ضغط فقط)

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { Giveaway } from '../../models';
import { Colors } from '../../utils/embeds';

const handler: ButtonHandler = {
  id: 'giveaway:list',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const shortId = interaction.customId.split(':')[3];
    if (!shortId) {
      await interaction.reply({ content: '❌ زر سحب غير صالح', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const giveaway = await Giveaway.findOne({ guildId: interaction.guildId, shortId: shortId.toUpperCase() });
    if (!giveaway) {
      await interaction.editReply({ content: '❌ لم أجد هذا السحب' });
      return;
    }

    const unique = Array.from(new Set((giveaway.entries || []).map(String)));

    if (unique.length === 0) {
      await interaction.editReply({ content: '📭 لا يوجد مشاركون في هذا السحب بعد' });
      return;
    }

    // تنسيق القائمة — 20 عضو لكل سطر حتى يوفر مساحة
    const mention = (id: string) => `<@${id}>`;
    const perLine = 20;
    const lines: string[] = [];
    for (let i = 0; i < unique.length; i += perLine) {
      lines.push(unique.slice(i, i + perLine).map(mention).join(' '));
    }

    const winners = new Set(giveaway.winnerIds || []);
    const winnersList = [...winners].filter(id => unique.includes(id)).map(mention).join('، ');

    const embed = new EmbedBuilder()
      .setTitle(`👥 مشاركو السحب — ${giveaway.prize}`)
      .setColor(Colors.primary)
      .setDescription(
        `**العدد:** \`${unique.length}\` مشارك\n` +
          (winnersList ? `🏆 **الفائزون:** ${winnersList}\n` : '') +
          `\n${lines.join('\n').slice(0, 3800)}`
      )
      .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${interaction.guild.name}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default handler;
