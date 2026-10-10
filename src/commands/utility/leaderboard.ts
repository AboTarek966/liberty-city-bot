// ============================================
// Liberty City Bot - Leaderboard Command
// Interactive beautiful leaderboard (chat + voice)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

export type LBType = 'all' | 'messages' | 'voiceMinutes';
export type LBPeriod = 'day' | 'week' | 'month' | 'total';
export type LBLimit = '10' | '25' | 'all';

const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} دقيقة`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours < 24) return `${hours} ساعة${mins ? ` ${mins} دقيقة` : ''}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days} يوم${remHours ? ` ${remHours} ساعة` : ''}`;
}

export function periodLabel(period: LBPeriod): string {
  return period === 'day' ? '📅 اليوم' :
    period === 'week' ? '📆 هذا الأسبوع' :
    period === 'month' ? '🗓️ هذا الشهر' : '📈 الإجمالي';
}

function limitNumber(limit: LBLimit): number {
  return limit === 'all' ? 100 : parseInt(limit, 10);
}

function progressBar(value: number, max: number): string {
  if (max <= 0) return '░░░░░░░░░░';
  const filled = Math.max(0, Math.min(10, Math.round((value / max) * 10)));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function buildRankingLines(
  results: any[],
  type: 'messages' | 'voiceMinutes'
): string[] {
  if (results.length === 0) return ['📭 لا توجد بيانات بعد في هذه الفترة'];
  const max = type === 'messages' ? results[0].messages : results[0].voiceMinutes;
  const lines: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const value = type === 'messages'
      ? `**${r.messages}** رسالة`
      : `**${formatMinutes(r.voiceMinutes)}**`;
    const bar = progressBar(
      type === 'messages' ? r.messages : r.voiceMinutes,
      max
    );
    const medal = medals[i] || `**${i + 1}.**`;
    lines.push(`${medal} <@${r.userId}> — ${value}\n\`${bar}\``);
  }
  return lines;
}

export async function buildLeaderboardEmbed(
  client: LibertyClient,
  guildId: string,
  type: LBType,
  period: LBPeriod,
  limit: LBLimit
): Promise<EmbedBuilder> {
  const ln = limitNumber(limit);
  const resultsMsg = await client.activityTracker.getLeaderboard(guildId, period, 'messages', type === 'voiceMinutes' ? 1 : ln);
  const resultsVoice = await client.activityTracker.getLeaderboard(guildId, period, 'voiceMinutes', type === 'messages' ? 1 : ln);

  const embed = new EmbedBuilder()
    .setColor(Colors.warning)
    .setFooter({ text: 'Liberty City • يتم تحديث النشاط تلقائياً' })
    .setTimestamp();

  if (type === 'all') {
    embed.setTitle(`🏆 لوحة المتصدرين — ${periodLabel(period)}`);
    const topMsg = resultsMsg.slice(0, limitNumber(limit));
    const topVoice = resultsVoice.slice(0, limitNumber(limit));
    embed.addFields(
      {
        name: '📝 توب الشات',
        value: topMsg.length
          ? buildRankingLines(topMsg, 'messages').join('\n').substring(0, 1024)
          : '📭 لا توجد بيانات',
        inline: true,
      },
      {
        name: '🔊 توب الصوت',
        value: topVoice.length
          ? buildRankingLines(topVoice, 'voiceMinutes').join('\n').substring(0, 1024)
          : '📭 لا توجد بيانات',
        inline: true,
      }
    );
  } else if (type === 'messages') {
    embed.setTitle(`📝 توب الرسائل — ${periodLabel(period)}`);
    embed.setDescription(
      resultsMsg.length
        ? buildRankingLines(resultsMsg, 'messages').join('\n').substring(0, 4000)
        : '📭 لا توجد بيانات رسائل بعد'
    );
  } else {
    embed.setTitle(`🔊 توب الوقت الصوتي — ${periodLabel(period)}`);
    embed.setDescription(
      resultsVoice.length
        ? buildRankingLines(resultsVoice, 'voiceMinutes').join('\n').substring(0, 4000)
        : '📭 لا توجد بيانات صوتية بعد'
    );
  }

  return embed;
}

export function buildLeaderboardButtons(
  type: LBType,
  period: LBPeriod,
  limit: LBLimit
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb|all|${period}|${limit}`)
      .setLabel('الكل')
      .setStyle(type === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('🏆'),
    new ButtonBuilder()
      .setCustomId(`lb|messages|${period}|${limit}`)
      .setLabel('الشات')
      .setStyle(type === 'messages' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('📝'),
    new ButtonBuilder()
      .setCustomId(`lb|voiceMinutes|${period}|${limit}`)
      .setLabel('الصوت')
      .setStyle(type === 'voiceMinutes' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('🔊'),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|${period}|${limit}`)
      .setLabel('تحديث')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb|${type}|day|${limit}`)
      .setLabel('يومي')
      .setStyle(period === 'day' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📅'),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|week|${limit}`)
      .setLabel('أسبوعي')
      .setStyle(period === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📆'),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|month|${limit}`)
      .setLabel('شهري')
      .setStyle(period === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('🗓️'),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|total|${limit}`)
      .setLabel('الإجمالي')
      .setStyle(period === 'total' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📈'),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb|${type}|${period}|10`)
      .setLabel('توب 10')
      .setStyle(limit === '10' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('🔟'),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|${period}|25`)
      .setLabel('توب 25')
      .setStyle(limit === '25' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('👥'),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|${period}|all`)
      .setLabel('كل الأعضاء')
      .setStyle(limit === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji('📜'),
  );

  return [row1, row2, row3];
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 لوحة المتصدرين — توب الأعضاء في الشات والصوت')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('نوع التصنيف')
        .setRequired(false)
        .addChoices(
          { name: '🏆 الكل (شات + صوت)', value: 'all' },
          { name: '📝 الرسائل', value: 'messages' },
          { name: '🔊 الوقت الصوتي', value: 'voiceMinutes' }
        )
    )
    .addStringOption(option =>
      option
        .setName('period')
        .setDescription('الفترة الزمنية')
        .setRequired(false)
        .addChoices(
          { name: '📅 يومي', value: 'day' },
          { name: '📆 أسبوعي', value: 'week' },
          { name: '🗓️ شهري', value: 'month' },
          { name: '📈 إجمالي', value: 'total' }
        )
    )
    .addStringOption(option =>
      option
        .setName('limit')
        .setDescription('عدد الأعضاء المعروضين')
        .setRequired(false)
        .addChoices(
          { name: '🔟 توب 10', value: '10' },
          { name: '👥 توب 25', value: '25' },
          { name: '📜 كل الأعضاء', value: 'all' }
        )
    ),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const type = (interaction.options.getString('type') || 'all') as LBType;
    const period = (interaction.options.getString('period') || 'week') as LBPeriod;
    const limit = (interaction.options.getString('limit') || '10') as LBLimit;

    const embed = await buildLeaderboardEmbed(client, interaction.guildId!, type, period, limit);
    const components = buildLeaderboardButtons(type, period, limit);

    await interaction.reply({ embeds: [embed], components });
  },
};

export default command;
