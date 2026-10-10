// ============================================
// Liberty City Bot - Poll Command (الاستطلاعات)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';
import { Poll } from '../../models';

const MAX_OPTIONS = 6;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('📊 استطلاع رأي — تصويت مباشر بالأزرار')
    .addStringOption(opt =>
      opt.setName('question').setDescription('السؤال').setRequired(true).setMaxLength(300)
    )
    .addStringOption(opt => opt.setName('option1').setDescription('الخيار 1').setRequired(true).setMaxLength(100))
    .addStringOption(opt => opt.setName('option2').setDescription('الخيار 2').setRequired(true).setMaxLength(100))
    .addStringOption(opt => opt.setName('option3').setDescription('الخيار 3').setMaxLength(100))
    .addStringOption(opt => opt.setName('option4').setDescription('الخيار 4').setMaxLength(100))
    .addStringOption(opt => opt.setName('option5').setDescription('الخيار 5').setMaxLength(100))
    .addStringOption(opt => opt.setName('option6').setDescription('الخيار 6').setMaxLength(100)),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const question = interaction.options.getString('question', true);

    const optionTexts: string[] = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) {
      const v = interaction.options.getString(`option${i}`);
      if (v) optionTexts.push(v.trim());
    }

    if (optionTexts.length < 2) {
      await interaction.reply({ content: '❌ تحتاج خيارين على الأقل', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Build a temporary in-memory poll so we can render the embed first,
    // then send the message, then persist with the real messageId (schema requires it).
    const tempPoll: any = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      ownerId: interaction.user.id,
      question,
      options: optionTexts.map(text => ({ text, votes: [] })),
    };

    const { embed, components } = buildPollEmbed(tempPoll, interaction.user.username);

    const channel = interaction.channel as TextChannel;
    const message = await channel.send({ embeds: [embed], components });

    // Persist only after we have the messageId (required by schema)
    await Poll.create({ ...tempPoll, messageId: message.id });

    await interaction.editReply({
      content: `✅ تم إنشاء الاستطلاع — [عرض التصويت](${message.url})`,
    });
  },
};

// --------------------------------------------
// Shared builder
// --------------------------------------------
export function buildPollEmbed(poll: any, authorName?: string): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const totalVotes = poll.options.reduce((sum: number, o: any) => sum + o.votes.length, 0);

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${poll.question}`)
    .setColor(Colors.primary)
    .addFields(
      poll.options.map((o: any, i: number) => {
        const count = o.votes.length;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const filled = Math.round(pct / 10);
        const bar = '🟦'.repeat(filled) + '⬜'.repeat(10 - filled);
        return {
          name: `${i + 1}️⃣ ${o.text}`.substring(0, 256),
          value: `${bar} **${pct}%** — ${count} صوت`,
          inline: false,
        };
      })
    )
    .setFooter({
      text: `صوّت بالأزرار بالأسفل${authorName ? ` • صنع بواسطة ${authorName}` : ''} • يمكنك تغيير صوتك`,
    })
    .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let current = new ActionRowBuilder<ButtonBuilder>();

  poll.options.forEach((o: any, i: number) => {
    if (current.components.length >= 5) {
      rows.push(current);
      current = new ActionRowBuilder<ButtonBuilder>();
    }
    current.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll|${i}`)
        .setLabel(`${i + 1}. ${o.text}`.substring(0, 80))
        .setStyle(ButtonStyle.Secondary)
    );
  });
  if (current.components.length > 0) rows.push(current);

  return { embed, components: rows };
}

export default command;
