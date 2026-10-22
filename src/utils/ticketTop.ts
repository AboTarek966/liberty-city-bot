// ============================================
// Liberty City Bot - توب إداريين التذاكر
// قائمة متصدرين لاستلام التذاكر بفترة (يومي/أسبوعي/شهري/إجمالي)
// الشكل: ميداليات + ترتيب نظيف + أزرار فترة وتنقل
// customId: ttop|<period>|<page>
// ============================================

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
} from 'discord.js';
import { getGuildSettings } from '../models';
import { Colors } from './embeds';

export type TicketTopPeriod = 'day' | 'week' | 'month' | 'total';

export const TICKET_TOP_PERIODS: TicketTopPeriod[] = ['day', 'week', 'month', 'total'];

export function sanitizeTicketTopPeriod(v?: string | null): TicketTopPeriod {
  return TICKET_TOP_PERIODS.includes(v as TicketTopPeriod) ? (v as TicketTopPeriod) : 'total';
}

export function ticketPeriodLabel(period: TicketTopPeriod): string {
  return period === 'day' ? '📅 اليوم'
    : period === 'week' ? '📆 هذا الأسبوع'
      : period === 'month' ? '🗓️ هذا الشهر'
        : '📈 الإجمالي';
}

const PAGE_SIZE = 5;
const MEDALS = ['🥇', '🥈', '🥉'];

function periodStart(period: TicketTopPeriod): Date | null {
  const now = new Date();
  if (period === 'day') {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === 'week') {
    // بداية الأسبوع = الأحد
    const day = now.getDay();
    now.setDate(now.getDate() - day);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === 'month') {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  return null; // الإجمالي
}

export interface TicketTopPage {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
  page: number;
  totalPages: number;
  totalAdmins: number;
}

export async function buildTicketTopPage(
  guild: Guild,
  period: TicketTopPeriod,
  page: number
): Promise<TicketTopPage> {
  const settings = await getGuildSettings(guild.id);
  const start = periodStart(period);

  // عدّ التذاكر المستلمة لكل إداري حسب الفترة
  const counts = new Map<string, number>();
  const log: Array<{ userId: string; at: Date }> = (settings.tickets as any).claimLog || [];

  if (start) {
    for (const entry of log) {
      const at = new Date(entry.at);
      if (at >= start) counts.set(entry.userId, (counts.get(entry.userId) || 0) + 1);
    }
  } else {
    // الإجمالي من العدّاد الكلي المحفوظ
    const stats = settings.tickets.claimStats;
    if (stats) for (const [uid, c] of stats.entries()) if (c > 0) counts.set(uid, c);
  }

  const sorted = [...counts.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const lines = slice.map(([userId, count], i) => {
    const rank = (safePage - 1) * PAGE_SIZE + i + 1;
    const badge = MEDALS[rank - 1] || `**#${rank}**`;
    return `${badge} <@${userId}> — **${count}** تذكرة`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.primary)
    .setTitle(`🎫 توب إداريين التذاكر — ${ticketPeriodLabel(period)}`)
    .setDescription(
      [
        `🏆 **${guild.name}**`,
        '',
        lines.length ? lines.join('\n') : '📭 لا توجد تذاكر مستلمة في هذه الفترة بعد',
      ].join('\n')
    )
    .setFooter({ text: `الصفحة ${safePage}/${totalPages} • ${sorted.length} إداري` })
    .setTimestamp();

  const icon = guild.iconURL({ size: 128 });
  if (icon) embed.setThumbnail(icon);

  return {
    embed,
    components: buildTicketTopComponents(period, safePage, totalPages),
    page: safePage,
    totalPages,
    totalAdmins: sorted.length,
  };
}

export function buildTicketTopComponents(
  period: TicketTopPeriod,
  page: number,
  totalPages: number
): ActionRowBuilder<ButtonBuilder>[] {
  const at = (p: number, mark?: string) => `ttop|${period}|${p}${mark ? `|${mark}` : ''}`;

  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(at(page, 'prev')).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`ttopg|${page}`).setLabel(`${page}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(at(page, 'next')).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId(at(page, 'r')).setEmoji('🔄').setLabel('تحديث').setStyle(ButtonStyle.Primary)
  );

  const periods = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ttop|day|1|p`).setLabel('يومي').setEmoji('📅').setStyle(period === 'day' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ttop|week|1|p`).setLabel('أسبوعي').setEmoji('📆').setStyle(period === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ttop|month|1|p`).setLabel('شهري').setEmoji('🗓️').setStyle(period === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ttop|total|1|p`).setLabel('الإجمالي').setEmoji('📈').setStyle(period === 'total' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  return [nav, periods];
}
