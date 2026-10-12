// ============================================
// Liberty City Bot - Activity Command
// Track text & voice activity: daily/weekly/monthly/total
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  User,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';

function formatMinutes(total: number): string {
  if (total < 60) return `${total} دقيقة`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours < 24) return `${hours} ساعة${mins ? ` ${mins} دقيقة` : ''}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days} يوم${remHours ? ` ${remHours} ساعة` : ''}`;
}

const periodLabels: Record<string, string> = {
  day: '📅 اليوم',
  week: '📆 هذا الأسبوع',
  month: '🗓️ هذا الشهر',
  total: '📈 الإجمالي',
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('عرض إحصائيات النشاط (نص وصوت)')
    .addUserOption(option =>
      option.setName('user').setDescription('العضو لعرض إحصائياته').setRequired(false)
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
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user') || interaction.user;
    const period = interaction.options.getString('period') || 'all';

    const stats = await client.activityTracker.getStatsAllPeriods(
      interaction.guildId!,
      target.id
    );

    const content =
      `📊 نشاط **${target.username}** —` +
      ` 📈 الإجمالي: ${stats.total.messages} رسالة • ${formatMinutes(stats.total.voiceMinutes)} صوت |` +
      ` 📅 اليوم: ${stats.day.messages} رسالة • ${formatMinutes(stats.day.voiceMinutes)} |` +
      ` 📆 أسبوع: ${stats.week.messages} رسالة • ${formatMinutes(stats.week.voiceMinutes)} |` +
      ` 🗓️ شهر: ${stats.month.messages} رسالة • ${formatMinutes(stats.month.voiceMinutes)}`;

    await interaction.reply({ content });
  },
};

export default command;
