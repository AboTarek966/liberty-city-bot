// ============================================
// Omni Bot - Giveaway Engine
// ============================================
// سحب كامل: إنشاء، مشاركة، سحب الفائز، إعادة السحب، واستعادة بعد
// إعادة تشغيل البوت. كل الحالة محفوظة في MongoDB.

import {
  Client,
  Guild,
  GuildMember,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { randomInt } from 'crypto';
import { Giveaway, IGiveaway, IGiveawayRequirements, UserProfile, getGuildSettings } from '../models';
import { createLogger, formatDuration } from './helpers';
import { Colors } from './embeds';

const logger = createLogger('Giveaway');

const MAX_TIMER_MS = 2_147_000_000; // حد setTimeout الآمن (~24.8 يوم)
const timers = new Map<string, NodeJS.Timeout>();

const SHORT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface CreateGiveawayInput {
  guildId: string;
  channelId: string;
  hostId: string;
  prize: string;
  description?: string;
  winnersCount: number;
  durationMs: number;
  requirements: Partial<IGiveawayRequirements>;
}

export interface GiveawayResult {
  ok: boolean;
  reason?: string;
  left?: boolean;
  giveaway?: IGiveaway;
  winners?: string[];
}

// --------------------------------------------
// Helpers
// --------------------------------------------
export function generateShortId(length = 6): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += SHORT_ID_ALPHABET[randomInt(0, SHORT_ID_ALPHABET.length)];
  }
  return id;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'انتهى';
  return formatDuration(ms, { compact: true });
}

function toRequirementObject(input: Partial<IGiveawayRequirements>): IGiveawayRequirements {
  return {
    roleIds: Array.from(new Set((input.roleIds || []).filter(Boolean))),
    minLevel: Math.max(0, Math.trunc(input.minLevel || 0)),
    minAccountAgeDays: Math.max(0, Math.trunc(input.minAccountAgeDays || 0)),
    minInvites: Math.max(0, Math.trunc(input.minInvites || 0)),
  };
}

export function requirementLines(req?: Partial<IGiveawayRequirements>): string[] {
  if (!req) return [];
  const lines: string[] = [];
  if (req.roleIds?.length) {
    lines.push(`> 🎭 رول مطلوب: ${req.roleIds.map(id => `<@&${id}>`).join('، ')}`);
  }
  if ((req.minLevel || 0) > 0) lines.push(`> 📈 أقل مستوى: \`${req.minLevel}\``);
  if ((req.minAccountAgeDays || 0) > 0) {
    lines.push(`> 🕰️ عمر الحساب: \`${req.minAccountAgeDays}\` يوم على الأقل`);
  }
  if ((req.minInvites || 0) > 0) lines.push(`> 📨 دعوات مطلوبة: \`${req.minInvites}\``);
  return lines;
}

// --------------------------------------------
// Invite counting (cached — avoids hammering Discord on every join)
// --------------------------------------------
const inviteCache = new Map<string, { ts: number; counts: Map<string, number> }>();
const INVITE_CACHE_TTL = 60_000;

async function countInvitesByUser(guild: Guild): Promise<Map<string, number>> {
  const cached = inviteCache.get(guild.id);
  if (cached && Date.now() - cached.ts < INVITE_CACHE_TTL) return cached.counts;

  const counts = new Map<string, number>();
  try {
    const invites = await guild.invites.fetch();
    for (const invite of invites.values()) {
      if (!invite.inviterId) continue;
      counts.set(invite.inviterId, (counts.get(invite.inviterId) || 0) + (invite.uses || 0));
    }
  } catch (error: any) {
    logger.warn(`Could not fetch invites for ${guild.name}: ${error.message}`);
  }

  inviteCache.set(guild.id, { ts: Date.now(), counts });
  return counts;
}

export function invalidateInviteCache(guildId: string): void {
  inviteCache.delete(guildId);
}

// --------------------------------------------
// Requirements check
// --------------------------------------------
export async function checkGiveawayRequirements(
  guild: Guild,
  member: GuildMember,
  requirements: Partial<IGiveawayRequirements>,
  inviteCounts?: Map<string, number>
): Promise<string[]> {
  const missing: string[] = [];
  const req = toRequirementObject(requirements);

  if (req.roleIds.length) {
    const absent = req.roleIds.filter(id => !member.roles.cache.has(id));
    if (absent.length) {
      missing.push(`تحتاج رول ${absent.map(id => `<@&${id}>`).join('، ')}`);
    }
  }

  if (req.minLevel > 0) {
    const profile = await UserProfile.findOne({ guildId: guild.id, userId: member.id });
    const level = profile?.level || 0;
    if (level < req.minLevel) missing.push(`مستواك \`${level}\` — المطلوب \`${req.minLevel}\``);
  }

  if (req.minAccountAgeDays > 0) {
    const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
    if (ageDays < req.minAccountAgeDays) {
      missing.push(`عمر حسابك \`${Math.floor(ageDays)}\` يوم — المطلوب \`${req.minAccountAgeDays}\``);
    }
  }

  if (req.minInvites > 0) {
    const counts = inviteCounts || (await countInvitesByUser(guild));
    const invites = counts.get(member.id) || 0;
    if (invites < req.minInvites) {
      missing.push(`دعواتك \`${invites}\` — المطلوب \`${req.minInvites}\``);
    }
  }

  return missing;
}

// --------------------------------------------
// Build message
// --------------------------------------------
export function buildGiveawayPayload(
  giveaway: IGiveaway,
  state: { ended?: boolean; winners?: string[] } = {},
  guildName?: string
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const ended = state.ended ?? giveaway.ended;
  const winners = state.winners ?? giveaway.winnerIds ?? [];
  const endsAt = new Date(giveaway.endsAt).getTime();
  const remaining = ended ? 0 : endsAt - Date.now();

  const embed = new EmbedBuilder()
    .setTitle(ended ? `🏁 انتهى السحب — ${giveaway.prize}` : `🎉 ${giveaway.prize}`)
    .setColor(ended ? Colors.Grey : Colors.primary)
    .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guildName || 'Omni'}` })
    .setTimestamp();

  const lines: string[] = [];
  if (giveaway.description) lines.push(giveaway.description, '');
  lines.push(
    ended
      ? `> 🏁 **انتهى السحب** ${giveaway.endedAt ? `<t:${Math.floor(new Date(giveaway.endedAt).getTime() / 1000)}:R>` : ''}`
      : `> ⏳ **ينتهي:** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)`,
    `> 👥 **المشاركون:** \`${giveaway.entries.length}\``,
    `> 🏆 **عدد الفائزين:** \`${giveaway.winnersCount}\``,
    `> 🎩 **صاحب السحب:** <@${giveaway.hostId}>`
  );

  const reqLines = requirementLines(giveaway.requirements);
  if (reqLines.length) {
    lines.push('', '**📋 شروط المشاركة:**', ...reqLines);
  }

  if (ended) {
    lines.push(
      '',
      winners.length
        ? `**🏆 الفائزون:** ${winners.map(id => `<@${id}>`).join('، ')}`
        : '**🏆 الفائزون:** لا يوجد — لم يشارك أحد'
    );
  } else if (remaining > 0) {
    lines.push('', `> ⌛ **الوقت المتبقي:** \`${formatRemaining(remaining)}\``);
  }

  embed.setDescription(lines.join('\n'));

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:entry:${giveaway.shortId}`)
      .setLabel(ended ? 'انتهى السحب' : '🎉 شارك / انسحب')
      .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(ended)
  );

  return { embeds: [embed], components: [row] };
}

export async function refreshGiveawayMessage(client: Client, giveaway: IGiveaway): Promise<void> {
  try {
    if (!giveaway.messageId) return;
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const message = await (channel as TextChannel).messages.fetch(giveaway.messageId).catch(() => null);
    if (!message) return;
    const payload = buildGiveawayPayload(giveaway, {}, client.guilds.cache.get(giveaway.guildId)?.name);
    await message.edit({ embeds: payload.embeds, components: payload.components }).catch(() => {});
  } catch (error: any) {
    logger.debug(`Could not refresh giveaway ${giveaway.shortId}: ${error.message}`);
  }
}

// --------------------------------------------
// Settings helpers
// --------------------------------------------
interface GiveawayOptions {
  dmWinners: boolean;
  pingWinners: boolean;
  logChannelId?: string;
}

async function getGiveawayOptions(guildId: string): Promise<GiveawayOptions> {
  const settings = await getGuildSettings(guildId).catch(() => null);
  const cfg = settings?.giveaways;
  return {
    dmWinners: cfg?.dmWinners !== false,
    pingWinners: cfg?.pingWinners !== false,
    logChannelId: cfg?.logChannelId,
  };
}

async function sendGiveawayLog(
  client: Client,
  giveaway: IGiveaway,
  logChannelId: string | undefined,
  embed: EmbedBuilder
): Promise<void> {
  if (!logChannelId) return;
  try {
    const channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    await (channel as TextChannel).send({ embeds: [embed] }).catch(() => {});
  } catch (error: any) {
    logger.debug(`Could not send giveaway log: ${error.message}`);
  }
}

// --------------------------------------------
// Create
// --------------------------------------------
export async function createGiveaway(input: CreateGiveawayInput): Promise<IGiveaway> {
  const requirements = toRequirementObject(input.requirements);

  let shortId = generateShortId();
  for (let attempt = 0; attempt < 8; attempt++) {
    const exists = await Giveaway.exists({ guildId: input.guildId, shortId });
    if (!exists) break;
    shortId = generateShortId();
  }

  return Giveaway.create({
    guildId: input.guildId,
    shortId,
    channelId: input.channelId,
    hostId: input.hostId,
    prize: input.prize.trim(),
    description: input.description?.trim() || '',
    winnersCount: Math.min(20, Math.max(1, Math.trunc(input.winnersCount))),
    endsAt: new Date(Date.now() + Math.max(10_000, input.durationMs)),
    requirements,
  });
}

// --------------------------------------------
// Resolve by short id or Mongo id
// --------------------------------------------
export async function findGiveaway(guildId: string, ref: string): Promise<IGiveaway | null> {
  const clean = ref.trim().replace(/^#/, '');
  if (/^[a-f\d]{24}$/i.test(clean)) {
    const byId = await Giveaway.findById(clean);
    if (byId && byId.guildId === guildId) return byId;
  }
  return Giveaway.findOne({ guildId, shortId: clean.toUpperCase() });
}

// --------------------------------------------
// Join / leave (toggle)
// --------------------------------------------
export async function toggleGiveawayEntry(
  client: Client,
  guildId: string,
  ref: string,
  member: GuildMember
): Promise<GiveawayResult> {
  const giveaway = await findGiveaway(guildId, ref);
  if (!giveaway) return { ok: false, reason: 'لم أجد هذا السحب' };
  if (giveaway.ended) return { ok: false, reason: 'هذا السحب انتهى بالفعل' };

  const alreadyIn = giveaway.entries.includes(member.id);
  if (alreadyIn) {
    giveaway.entries = giveaway.entries.filter(id => id !== member.id);
    await giveaway.save();
    await refreshGiveawayMessage(client, giveaway);
    return { ok: true, left: true, giveaway };
  }

  const inviteCounts = (giveaway.requirements?.minInvites || 0) > 0
    ? await countInvitesByUser(member.guild)
    : undefined;
  const missing = await checkGiveawayRequirements(
    member.guild,
    member,
    giveaway.requirements,
    inviteCounts
  );
  if (missing.length) {
    return { ok: false, reason: `لا تستوفي الشروط:\n> • ${missing.join('\n> • ')}` };
  }

  giveaway.entries.push(member.id);
  await giveaway.save();
  await refreshGiveawayMessage(client, giveaway);
  return { ok: true, left: false, giveaway };
}

// --------------------------------------------
// Pick winners
// --------------------------------------------
function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const winners: T[] = [];
  while (pool.length && winners.length < count) {
    winners.push(pool.splice(randomInt(0, pool.length), 1)[0]);
  }
  return winners;
}

async function eligibleEntries(
  guild: Guild,
  entries: string[],
  requirements: Partial<IGiveawayRequirements>
): Promise<GuildMember[]> {
  if (!entries.length) return [];

  const unique = Array.from(new Set(entries));
  const inviteCounts = (requirements.minInvites || 0) > 0
    ? await countInvitesByUser(guild)
    : undefined;

  // جلب الأعضاء على دفعات (حد ديسكورد 100 لكل طلب)
  const members = new Map<string, GuildMember>();
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    try {
      const fetched = await guild.members.fetch({ user: batch });
      for (const [id, member] of fetched) members.set(id, member);
    } catch {
      for (const id of batch) {
        const cached = guild.members.cache.get(id);
        if (cached) members.set(id, cached);
      }
    }
  }

  const result: GuildMember[] = [];
  for (const id of unique) {
    const member = members.get(id);
    if (!member) continue;
    const missing = await checkGiveawayRequirements(guild, member, requirements, inviteCounts);
    if (!missing.length) result.push(member);
  }
  return result;
}

// --------------------------------------------
// End
// --------------------------------------------
export async function endGiveaway(
  client: Client,
  guildId: string,
  ref: string
): Promise<GiveawayResult> {
  const giveaway = await findGiveaway(guildId, ref);
  if (!giveaway) return { ok: false, reason: 'لم أجد هذا السحب' };
  if (giveaway.ended) return { ok: false, reason: 'هذا السحب منتهٍ بالفعل' };

  return finishGiveaway(client, giveaway);
}

async function finishGiveaway(client: Client, giveaway: IGiveaway): Promise<GiveawayResult> {
  const guild = client.guilds.cache.get(giveaway.guildId);
  if (!guild) {
    giveaway.ended = true;
    giveaway.endedAt = new Date();
    giveaway.winnerIds = [];
    await giveaway.save();
    clearGiveawayTimer(giveaway._id.toString());
    return { ok: true, winners: [], giveaway };
  }

  const eligible = await eligibleEntries(guild, giveaway.entries, giveaway.requirements);
  const winners = pickRandom(eligible, giveaway.winnersCount).map(m => m.id);

  giveaway.ended = true;
  giveaway.endedAt = new Date();
  giveaway.winnerIds = winners;
  await giveaway.save();
  clearGiveawayTimer(giveaway._id.toString());

  await refreshGiveawayMessage(client, giveaway);

  const options = await getGiveawayOptions(giveaway.guildId);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel && channel.isTextBased()) {
    const announcement = new EmbedBuilder()
      .setTitle('🎉 نتيجة السحب')
      .setColor(winners.length ? Colors.success : Colors.warning)
      .setDescription(
        `**الجائزة:** ${giveaway.prize}\n` +
          `**المشاركون:** \`${giveaway.entries.length}\`\n\n` +
          (winners.length
            ? `🏆 **الفائزون:** ${winners.map(id => `<@${id}>`).join('، ')}\n\n` +
              `> 📩 سيتم التواصل معكم لاستلام الجائزة. مبروك!`
            : `😔 **لا يوجد فائز** — لم يستوفِ أحد الشروط أو لم يشارك أحد.`)
      )
      .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guild.name}` })
      .setTimestamp();

    await (channel as TextChannel).send({
      content:
        options.pingWinners && winners.length
          ? winners.map(id => `<@${id}>`).join(' ')
          : undefined,
      embeds: [announcement],
    }).catch(() => {});
  }

  if (options.dmWinners) {
    for (const winnerId of winners) {
      const member = guild.members.cache.get(winnerId);
      if (member) {
        await member.send(
          `🎉 مبروك! لقد فزت في سحب **${giveaway.prize}** في سيرفر **${guild.name}**.\n` +
            `تواصل مع الإدارة لاستلام جائزتك.`
        ).catch(() => {});
      }
    }
  }

  await sendGiveawayLog(
    client,
    giveaway,
    options.logChannelId,
    new EmbedBuilder()
      .setTitle('🏁 سجل سحب — انتهى')
      .setColor(winners.length ? Colors.success : Colors.warning)
      .setDescription(
        `> 🎁 **الجائزة:** ${giveaway.prize}\n` +
          `> 🆔 **المعرّف:** \`${giveaway.shortId}\`\n` +
          `> 👥 **المشاركون:** \`${giveaway.entries.length}\`\n` +
          `> 🎩 **صاحب السحب:** <@${giveaway.hostId}>\n` +
          `> 🏆 **الفائزون:** ${winners.length ? winners.map(id => `<@${id}>`).join('، ') : 'لا يوجد'}`
      )
      .setFooter({ text: guild.name })
      .setTimestamp()
  );

  logger.info(`Giveaway ${giveaway.shortId} ended — winners: ${winners.join(', ') || 'none'}`);
  return { ok: true, winners, giveaway };
}

// --------------------------------------------
// Reroll
// --------------------------------------------
export async function rerollGiveaway(
  client: Client,
  guildId: string,
  ref: string,
  winnersCount?: number
): Promise<GiveawayResult> {
  const giveaway = await findGiveaway(guildId, ref);
  if (!giveaway) return { ok: false, reason: 'لم أجد هذا السحب' };
  if (!giveaway.ended) return { ok: false, reason: 'لم ينتهِ هذا السحب بعد — استخدم `/giveaway end` أولاً' };

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, reason: 'السيرفر غير متاح' };

  const eligible = await eligibleEntries(guild, giveaway.entries, giveaway.requirements);
  const previous = new Set(giveaway.winnerIds || []);

  // نستبعد الفائزين السابقين إن كان هناك بدائل كافية
  let pool = eligible.filter(m => !previous.has(m.id));
  if (pool.length < Math.min(giveaway.winnersCount, eligible.length)) pool = eligible;

  const count = Math.min(
    Math.max(1, Math.trunc(winnersCount || giveaway.winnersCount)),
    Math.max(1, pool.length)
  );
  const winners = pickRandom(pool, count).map(m => m.id);

  if (!winners.length) return { ok: false, reason: 'لا يوجد مشاركون مؤهلون لإعادة السحب' };

  giveaway.winnerIds = winners;
  giveaway.endedAt = new Date();
  await giveaway.save();
  await refreshGiveawayMessage(client, giveaway);

  const options = await getGiveawayOptions(giveaway.guildId);

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (channel && channel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setTitle('🔄 إعادة سحب')
      .setColor(Colors.success)
      .setDescription(
        `**الجائزة:** ${giveaway.prize}\n\n` +
          `🎉 **الفائزون الجدد:** ${winners.map(id => `<@${id}>`).join('، ')}`
      )
      .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guild.name}` })
      .setTimestamp();

    await (channel as TextChannel).send({
      content: options.pingWinners ? winners.map(id => `<@${id}>`).join(' ') : undefined,
      embeds: [embed],
    }).catch(() => {});
  }

  if (options.dmWinners) {
    for (const winnerId of winners) {
      const member = guild.members.cache.get(winnerId);
      if (member) {
        await member.send(
          `🎉 مبروك! لقد فزت في إعادة سحب **${giveaway.prize}** في سيرفر **${guild.name}**.\n` +
            `تواصل مع الإدارة لاستلام جائزتك.`
        ).catch(() => {});
      }
    }
  }

  await sendGiveawayLog(
    client,
    giveaway,
    options.logChannelId,
    new EmbedBuilder()
      .setTitle('🔄 سجل سحب — إعادة سحب')
      .setColor(Colors.success)
      .setDescription(
        `> 🎁 **الجائزة:** ${giveaway.prize}\n` +
          `> 🆔 **المعرّف:** \`${giveaway.shortId}\`\n` +
          `> 🏆 **الفائزون الجدد:** ${winners.map(id => `<@${id}>`).join('، ')}`
      )
      .setFooter({ text: guild.name })
      .setTimestamp()
  );

  logger.info(`Giveaway ${giveaway.shortId} rerolled — winners: ${winners.join(', ')}`);
  return { ok: true, winners, giveaway };
}

// --------------------------------------------
// Scheduler
// --------------------------------------------
export function clearGiveawayTimer(giveawayId: string): void {
  const timer = timers.get(giveawayId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(giveawayId);
  }
}

export function scheduleGiveaway(client: Client, giveaway: IGiveaway): void {
  const key = giveaway._id.toString();
  clearGiveawayTimer(key);

  if (giveaway.ended) return;

  const delay = new Date(giveaway.endsAt).getTime() - Date.now();

  if (delay > MAX_TIMER_MS) {
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void Giveaway.findById(key)
          .then(fresh => {
            if (fresh && !fresh.ended) scheduleGiveaway(client, fresh);
          })
          .catch(() => {});
      }, MAX_TIMER_MS)
    );
    return;
  }

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void endGiveaway(client, giveaway.guildId, giveaway._id.toString())
        .then(result => {
          if (!result.ok) logger.warn(`Scheduled giveaway ${giveaway.shortId}: ${result.reason}`);
        })
        .catch(error => logger.error(`Scheduled giveaway failed: ${error.message}`));
    }, Math.max(0, delay))
  );
}

export async function restoreGiveaways(client: Client): Promise<void> {
  try {
    const active = await Giveaway.find({ ended: false }).limit(500);
    logger.info(`Restoring ${active.length} active giveaway(s)`);
    for (const giveaway of active) scheduleGiveaway(client, giveaway);
  } catch (error: any) {
    logger.error(`Could not restore giveaways: ${error.message}`);
  }
}
