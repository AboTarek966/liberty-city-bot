// ============================================
// Liberty City Bot - Rank Command (بطاقة المستوى التفاعلية)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

function topButton(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rank:top`)
      .setLabel('🏆 التوب')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏆'),
    new ButtonBuilder()
      .setCustomId(`rank:refresh:${userId}`)
      .setLabel('🔄 تحديث')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );
}

export async function buildTopEmbed(client: LibertyClient, guildId: string): Promise<EmbedBuilder> {
  const top = await client.levelingHandler.getTopMembers(guildId, 10);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  const lines = top.length
    ? top.map((p: any, i: number) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} <@${p.userId}> — المستوى \`${p.level}\` • \`${p.xp}\` XP`;
      })
    : ['📭 لا توجد بيانات بعد'];

  return new EmbedBuilder()
    .setColor(Colors.warning)
    .setTitle('🏆 لوحة المتصدرين — المستويات')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'استخدم /rank لعرض بطاقتك' })
    .setTimestamp();
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('📈 عرض بطاقة المستوى والخبرة — لك أو لأي عضو')
    .addUserOption(option =>
      option.setName('user').setDescription('العضو المراد عرض بطاقته (اختياري)').setRequired(false)
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user') || interaction.user;

    const member =
      interaction.guild?.members.cache.get(target.id) ||
      (await interaction.guild?.members.fetch(target.id).catch(() => null));

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
      return;
    }

    const card = await client.levelingHandler.buildRankCard(member);

    await interaction.reply({
      embeds: [card],
      components: [topButton(target.id)],
    });
  },
};

export default command;
