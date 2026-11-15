// ============================================
// Omni Bot - 🏆 /clantop — توب العشائر (صورة)
// — مرادف لـ /clan leaderboard ويشتغل من الاختصارات (/alias)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Clan } from '../../models';
import { ActivityStats } from '../../handlers/ActivityTracker';
import { renderClanLeaderboard, ClanLeaderboardEntry } from '../../utils/clanImage';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('ClanTop');

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodDate(period: string): string {
  const now = new Date();
  if (period === 'day') return dayKey(now);
  if (period === 'week') return weekKey(now);
  if (period === 'month') return monthKey(now);
  return 'all';
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clantop')
    .setDescription('🛡️ توب العشائر — صورة بأفضل عشائر السيرفر')
    .addStringOption((o) =>
      o
        .setName('period')
        .setDescription('الفترة الزمنية')
        .addChoices(
          { name: 'الكلي', value: 'total' },
          { name: 'الشهر', value: 'month' },
          { name: 'الأسبوع', value: 'week' },
          { name: 'اليوم', value: 'day' }
        )
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    await interaction.deferReply();

    const period = (interaction.options.getString('period') || 'total') as 'day' | 'week' | 'month' | 'total';
    const date = periodDate(period);
    const clans = await Clan.find({ guildId: interaction.guild.id, active: true }).lean();

    const entries: ClanLeaderboardEntry[] = [];
    for (const clan of clans) {
      const docs = await ActivityStats.find({ guildId: interaction.guild.id, userId: { $in: clan.members }, period, date }).lean();
      let messages = 0,
        voiceMinutes = 0;
      for (const doc of docs) {
        messages += (doc as any).messages || 0;
        voiceMinutes += (doc as any).voiceMinutes || 0;
      }
      entries.push({
        name: clan.name,
        ownerId: clan.ownerId,
        memberCount: clan.members.length,
        messages,
        voiceMinutes,
        color: clan.color,
      });
    }
    entries.sort((a, b) => (b.messages + b.voiceMinutes * 10) - (a.messages + a.voiceMinutes * 10));

    let image: Buffer | null = null;
    try {
      image = await renderClanLeaderboard(interaction.guild.name, entries.slice(0, 6));
    } catch (err: any) {
      logger.warn(`render failed: ${err?.message || err}`);
    }

    if (image) {
      const file = new AttachmentBuilder(image, { name: 'clantop.png' });
      await interaction.editReply({ content: '🛡️ توب العشائر', files: [file] });
    } else {
      const lines = entries.length
        ? entries.slice(0, 6).map((e, i) => `${i + 1}. **${e.name}** — رسائل ${e.messages} · صوت ${e.voiceMinutes}د · أعضاء ${e.memberCount}`).join('\n')
        : 'لا توجد عشائر بعد.';
      await interaction.editReply({ content: `🛡️ توب العشائر\n${lines}` });
    }
  },
};

export default command;
