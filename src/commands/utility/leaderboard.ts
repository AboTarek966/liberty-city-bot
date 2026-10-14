// ============================================
// Liberty City Bot - Leaderboard Command
// قائمة متصدرين بتبويب (يومي/أسبوعي/شهري/إجمالي) + ترقيم صفحات
// الشكل:  #1 @user — 📝 رسائل • 🔊 صوت
// الأزرار: ⬅️ | رقم الصفحة | ➡️ | 🔄 تحديث
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

export type LBType = 'all' | 'messages' | 'voiceMinutes';
export type LBPeriod = 'day' | 'week' | 'month' | 'total';
export type LBLimit = '10' | '25' | 'all';

/** عدد الأعضاء في كل صفحة — مطابق للشكل المطلوب (5 صفوف) */
export const LB_PAGE_SIZE = 5;
/** أقصى عدد صفوف نجلبه من قاعدة البيانات (حد أقصى للتصفح) */
const MAX_ROWS = 100;

// --------------------------------------------
// Helpers
// --------------------------------------------
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
  return period === 'day' ? '📅 اليوم'
    : period === 'week' ? '📆 هذا الأسبوع'
      : period === 'month' ? '🗓️ هذا الشهر' : '📈 الإجمالي';
}

export function limitNumber(limit: LBLimit): number {
  return limit === 'all' ? MAX_ROWS : parseInt(limit, 10);
}

/** ترقيم الصفحة بالعربية: الأولى، الثانية… ثم رقم عادي بعد العاشرة */
const AR_PAGES = [
  'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة',
  'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة',
];
function pageWord(page: number): string {
  return AR_PAGES[page - 1] || `${page}`;
}

// --------------------------------------------
// جلب الصفوف ودمج النتائج
// --------------------------------------------
export interface LBRow {
  userId: string;
  messages: number;
  voiceMinutes: number;
  score: number;
}

export async function fetchLeaderboardRows(
  client: LibertyClient,
  guildId: string,
  period: LBPeriod,
  type: LBType,
  limit: LBLimit
): Promise<LBRow[]> {
  const ln = limitNumber(limit);

  const [msgRows, voiceRows] = await Promise.all([
    client.activityTracker.getLeaderboard(guildId, period, 'messages', ln),
    client.activityTracker.getLeaderboard(guildId, period, 'voiceMinutes', ln),
  ]);

  // دمج القائمتين: نفس العضو قد يظهر فيهما معاً
  const map = new Map<string, { messages: number; voiceMinutes: number }>();
  const put = (r: any) => {
    const id = r?.userId;
    if (!id) return;
    const m = r.messages || 0;
    const v = r.voiceMinutes || 0;
    const cur = map.get(id);
    if (!cur) map.set(id, { messages: m, voiceMinutes: v });
    else {
      cur.messages = Math.max(cur.messages, m);
      cur.voiceMinutes = Math.max(cur.voiceMinutes, v);
    }
  };
  msgRows.forEach(put);
  voiceRows.forEach(put);

  const rows: LBRow[] = [];
  for (const [userId, s] of map) {
    // معيار الترتيب: حسب النوع المختار (الكل = مجموع النشاط)
    const score =
      type === 'voiceMinutes' ? s.voiceMinutes
        : type === 'messages' ? s.messages
          : s.messages + s.voiceMinutes;

    if (score <= 0) continue; // لا نعرض من لا نشاط له
    rows.push({ userId, messages: s.messages, voiceMinutes: s.voiceMinutes, score });
  }

  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.messages - a.messages ||
      b.voiceMinutes - a.voiceMinutes ||
      a.userId.localeCompare(b.userId)
  );

  return rows;
}

// --------------------------------------------
// بناء الصفحة
// --------------------------------------------
export interface LBPage {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
  page: number;
  totalPages: number;
  totalRows: number;
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  if (totalPages < 1) return 1;
  return Math.min(Math.floor(page), totalPages);
}

export async function buildLeaderboardPage(
  client: LibertyClient,
  guild: Guild,
  type: LBType,
  period: LBPeriod,
  limit: LBLimit,
  page: number
): Promise<LBPage> {
  const rows = await fetchLeaderboardRows(client, guild.id, period, type, limit);
  const totalPages = Math.max(1, Math.ceil(rows.length / LB_PAGE_SIZE));
  const safePage = clampPage(page, totalPages);

  const start = (safePage - 1) * LB_PAGE_SIZE;
  const slice = rows.slice(start, start + LB_PAGE_SIZE);

  const lines = slice.map((r, i) => {
    const rank = start + i + 1;
    return (
      `**#${rank}** <@${r.userId}> — ` +
      `📝 **${r.messages.toLocaleString('en-US')}** رسالة • ` +
      `🔊 **${formatMinutes(r.voiceMinutes)}**`
    );
  });

  const description = [
    `🏆 **${guild.name}**`,
    '',
    lines.length
      ? lines.join('\n')
      : '📭 لا توجد بيانات نشاط في هذه الفترة بعد',
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.warning)
    .setTitle(`قائمة المتصدرين — ${periodLabel(period)}`)
    .setDescription(description.substring(0, 4000))
    .setFooter({
      text: `الصفحة: ${pageWord(safePage)} • ${safePage}/${totalPages} صفحة • ${rows.length} عضو`,
    })
    .setTimestamp();

  const icon = guild.iconURL({ size: 128 });
  if (icon) embed.setThumbnail(icon);

  return {
    embed,
    components: buildLeaderboardComponents(type, period, limit, safePage, totalPages),
    page: safePage,
    totalPages,
    totalRows: rows.length,
  };
}

// --------------------------------------------
// الأزرار
// customId: lb|<type>|<period>|<limit>|<page>[|<mark>]
//   mark: prev / next / r (تحديث) / p (فترة) / t (نوع)
// البادئة المختلفة تضمن عدم تكرار custom_id داخل الرسالة الواحدة
// --------------------------------------------
export function buildLeaderboardComponents(
  type: LBType,
  period: LBPeriod,
  limit: LBLimit,
  page: number,
  totalPages: number
): ActionRowBuilder<ButtonBuilder>[] {
  const at = (p: number, mark?: string) =>
    `lb|${type}|${period}|${limit}|${p}${mark ? `|${mark}` : ''}`;

  // الصف الأول — التنقل (مطابق للشكل: ⬅️ | رقم | ➡️ | 🔄)
  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(at(page, 'prev'))
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`pg|${page}`)
      .setLabel(`${page}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(at(page, 'next'))
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder()
      .setCustomId(at(page, 'r'))
      .setEmoji('🔄')
      .setLabel('تحديث')
      .setStyle(ButtonStyle.Primary)
  );

  // الصف الثاني — الفترة (تختلف النتائج معها)
  const periods = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb|${type}|day|${limit}|1|p`)
      .setLabel('يومي')
      .setEmoji('📅')
      .setStyle(period === 'day' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|week|${limit}|1|p`)
      .setLabel('أسبوعي')
      .setEmoji('📆')
      .setStyle(period === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|month|${limit}|1|p`)
      .setLabel('شهري')
      .setEmoji('🗓️')
      .setStyle(period === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`lb|${type}|total|${limit}|1|p`)
      .setLabel('الإجمالي')
      .setEmoji('📈')
      .setStyle(period === 'total' ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  // الصف الثالث — نوع الترتيب
  const types = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb|all|${period}|${limit}|1|t`)
      .setLabel('الكل')
      .setEmoji('🏆')
      .setStyle(type === 'all' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`lb|messages|${period}|${limit}|1|t`)
      .setLabel('الشات')
      .setEmoji('📝')
      .setStyle(type === 'messages' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`lb|voiceMinutes|${period}|${limit}|1|t`)
      .setLabel('الصوت')
      .setEmoji('🔊')
      .setStyle(type === 'voiceMinutes' ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return [nav, periods, types];
}

// --------------------------------------------
// Slash Command
// --------------------------------------------
const VALID_TYPES: LBType[] = ['all', 'messages', 'voiceMinutes'];
const VALID_PERIODS: LBPeriod[] = ['day', 'week', 'month', 'total'];
const VALID_LIMITS: LBLimit[] = ['10', '25', 'all'];

export function sanitizeType(v?: string | null): LBType {
  return VALID_TYPES.includes(v as LBType) ? (v as LBType) : 'all';
}
export function sanitizePeriod(v?: string | null): LBPeriod {
  return VALID_PERIODS.includes(v as LBPeriod) ? (v as LBPeriod) : 'week';
}
export function sanitizeLimit(v?: string | null): LBLimit {
  return VALID_LIMITS.includes(v as LBLimit) ? (v as LBLimit) : 'all';
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 قائمة المتصدرين — توب الأعضاء يومياً وأسبوعياً وشهرياً')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('نوع الترتيب')
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
        .setDescription('عدد الأعضاء في القائمة')
        .setRequired(false)
        .addChoices(
          { name: '🔟 توب 10', value: '10' },
          { name: '👥 توب 25', value: '25' },
          { name: '📜 كل الأعضاء', value: 'all' }
        )
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const type = sanitizeType(interaction.options.getString('type'));
    const period = sanitizePeriod(interaction.options.getString('period'));
    const limit = sanitizeLimit(interaction.options.getString('limit'));

    const page = await buildLeaderboardPage(
      client,
      interaction.guild!,
      type,
      period,
      limit,
      1
    );

    await interaction.reply({ embeds: [page.embed], components: page.components });
  },
};

export default command;
