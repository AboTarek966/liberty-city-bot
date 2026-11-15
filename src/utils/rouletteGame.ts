// ============================================
// Omni Bot - 🔫 روليت (لعبة جماعية تفاعلية)
// /roulette → رسالة دعوة فيها زر دخول + زر خروج + عد تنازلي 60 ثانية
// ثم عجَلة تدور كل جولة، واللي تقف عليه يختار يطرد مين (أو يُطرَد هو لو ما ختارش في 30 ثانية)
// حتى يتبقى واحد = الفائز 🎉
// ============================================

import type { OmniClient } from '../OmniClient';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import { renderWheelOfFortuneGif, fetchAvatarBuffer, WheelSegmentInput } from './wheelOfFortune';
import { createLogger } from './helpers';

const logger = createLogger('Roulette');

export interface RoulettePlayer {
  id: string;
  username: string;
  avatarUrl?: string;
  /** true لو ده بوت (مش إنسان) */
  isBot?: boolean;
}

export type RoulettePhase = 'lobby' | 'spinning' | 'choosing' | 'done';

export interface RouletteGame {
  id: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  phase: RoulettePhase;
  players: RoulettePlayer[];
  avatarBuffers: (Buffer | null)[];
  chooserId?: string;
  choiceMessageId?: string;
  choiceTimer?: NodeJS.Timeout;
  startTimer?: NodeJS.Timeout;
}

export const rouletteGames = new Map<string, RouletteGame>();

export const MAX_ROULETTE_PLAYERS = 25;
/** الحد الأدنى لعدد اللاعبين قبل بدأ اللعبة */
export const MIN_ROULETTE_PLAYERS = 4;
const LOBBY_SECONDS = 60;
const CHOICE_SECONDS = 30;

const COLOR = 0xed4245;

// ---------- واجهة اللوبي ----------

export function lobbyEmbed(game: RouletteGame, startText = 'تبدأ اللعبة خلال 60 ثانية'): EmbedBuilder {
  const names = game.players.length
    ? game.players.map((p, i) => `\`${i + 1}.\` <@${p.id}> \`${p.username.slice(0, 32)}\``).join('\n')
    : 'لا أحد انضم بعد — اضغط **دخول اللعبة**!';
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('🔫 لعبة الروليت')
    .setDescription(
      'العجلة بتلف كل جولة — واللي تقف عليه لازم **يطرد لاعباً من اللعبة**.\n' +
        'اللعبة تفضل هكذا حتى يتبقى **آخر لاعب** ويكون هو الفائز 👑\n\n' +
        '**القوانين:**\n' +
        '• 60 ثانية للانضمام، وبعدها تبدأ اللعبة تلقائياً\n' +
        '• الحد الأدنى **٤ لاعبين** للبداية — وصلك لـ 4؟ اضغط **🤖 إضافة بوتات** وتختار العدد\n' +
        '• بعد ما العجلة تقف على واحد — عنده **30 ثانية** يختار من يطرده (بزرار الشات)\n' +
        '• لو ما اختارش في الوقت المحدد → هو نفسه يتطرد 💀\n' +
        '• ممنوع الخروج بعد بدء اللعبة — الطرد هو الفاصل الوحيد'
    )
    .addFields({
      name: `👥 المشاركون (${game.players.length}/${MAX_ROULETTE_PLAYERS})`,
      value: names.slice(0, 1024),
    })
    .setFooter({ text: `${LOBBY_SECONDS} ثانية • ${startText}` })
    .setTimestamp();
}

export function lobbyRow(game: RouletteGame): ActionRowBuilder<ButtonBuilder>[] {
  const join = new ButtonBuilder()
    .setCustomId(`roulette:join:${game.id}`)
    .setLabel('دخول اللعبة')
    .setStyle(ButtonStyle.Success)
    .setEmoji('➕');
  const leave = new ButtonBuilder()
    .setCustomId(`roulette:leave:${game.id}`)
    .setLabel('خروج من اللعبة')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🚪');
  const addBots = new ButtonBuilder()
    .setCustomId(`roulette:addbots:${game.id}`)
    .setLabel('🤖 إضافة بوتات')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🤖');
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(join, leave, addBots)];
}

// ---------- بدء اللعبة ----------

export async function startRouletteGame(client: OmniClient, gameId: string): Promise<void> {
  const game = rouletteGames.get(gameId);
  if (!game || game.phase !== 'lobby') return;

  // مسح زرار اللوبي — المشاركين النهائيين
  clearTimeout(game.startTimer);
  game.startTimer = undefined;

  const guild = client.guilds.cache.get(game.guildId);
  const channel: any = guild?.channels.cache.get(game.channelId);
  if (!guild || !channel) {
    cleanup(game);
    return;
  }

  if (game.players.length < MIN_ROULETTE_PLAYERS) {
    game.phase = 'done';
    await disableLobbyMessage(client, game).catch(() => {});
    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle('❌ ألغيت لعبة الروليت')
            .setDescription(
              `لم ينضم ${MIN_ROULETTE_PLAYERS} لاعبين على الأقل خلال دقيقة (المنضم: ${game.players.length}).\n` +
                'اضغط **🤖 إضافة بوتات** قبل بدء اللعبة لو العدد غير كافٍ، أو حاول مرة أخرى.'
            )
            .setTimestamp(),
        ],
      })
      .catch(() => {});
    cleanup(game);
    return;
  }

  game.phase = 'spinning';
  // إزالة زرار اللوبي من الرسالة الأصلية
  await disableLobbyMessage(client, game).catch(() => {});

  // جيب الآفاتارات مرة واحدة للعبة كلها (بتُعاد استخدامها في كل عجلة)
  game.avatarBuffers = await Promise.all(
    game.players.map((p) =>
      p.avatarUrl ? fetchAvatarBuffer(p.avatarUrl).catch(() => null) : Promise.resolve(null)
    )
  );

  await runRouletteRound(client, game);
}

async function disableLobbyMessage(client: OmniClient, game: RouletteGame): Promise<void> {
  if (!game.messageId) return;
  const guild = client.guilds.cache.get(game.guildId);
  const channel: any = guild?.channels.cache.get(game.channelId);
  if (!channel) return;
  try {
    const msg = await channel.messages.fetch(game.messageId);
    await msg.edit({ components: [] });
  } catch {
    /* الرسالة قد لا تكون قابلة للتعديل — تجاهل */
  }
}

// ---------- الدوران ----------

export async function runRouletteRound(client: OmniClient, game: RouletteGame): Promise<void> {
  if (game.phase === 'done') return;
  game.phase = 'spinning';

  const guild = client.guilds.cache.get(game.guildId);
  const channel: any = guild?.channels.cache.get(game.channelId);
  if (!guild || !channel) {
    cleanup(game);
    return;
  }

  const segments: WheelSegmentInput[] = game.players.map((p, i) => ({
    label: (p.username || '?').slice(0, 12),
    image: game.avatarBuffers[i],
  }));
  const winnerIndex = Math.floor(Math.random() * game.players.length);
  const chosen = game.players[winnerIndex];

  let gif: Buffer | null = null;
  try {
    gif = await renderWheelOfFortuneGif({
      title: 'روليت',
      subtitle: 'دور — وادفع مين يُطرَد',
      segments,
      winnerIndex,
      hubText: 'OMNI',
      width: 440,
    });
  } catch (err: any) {
    logger.warn(`wheel gif failed: ${err?.message || err}`);
  }

  const spinEmbed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('🎡 العجلة تدور...')
    .setDescription(`👥 المتبقون: ${game.players.map((p) => `<@${p.id}>`).join(' • ')}`)
    .setTimestamp();

  if (gif) {
    game.choiceTimer && clearTimeout(game.choiceTimer);
    await channel
      .send({
        embeds: [spinEmbed],
        files: [new AttachmentBuilder(gif, { name: 'roulette.gif' })],
      })
      .catch(() => {});
  } else {
    await channel.send({ embeds: [spinEmbed] }).catch(() => {});
  }

  // بعد اللف (لحد ما تقف العجلة) — نوقف على اللي اختارته
  setTimeout(
    () => void openKickMenu(client, game.id, chosen.id),
    gif ? 2800 : 1600
  );
}

// ---------- اختيار الطرد ----------

function kickButtonRows(game: RouletteGame, chooserId: string): ActionRowBuilder<ButtonBuilder>[] {
  const targets = game.players.filter((p) => p.id !== chooserId);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < targets.length; i += 5) {
    const slice = targets.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const p of slice) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`roulette:kick:${game.id}:${p.id}`)
          .setLabel((p.username || 'لاعب').slice(0, 24))
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔫')
      );
    }
    rows.push(row);
  }
  return rows;
}

async function openKickMenu(client: OmniClient, gameId: string, chooserId: string): Promise<void> {
  const game = rouletteGames.get(gameId);
  if (!game || game.phase === 'done') return;
  if (!game.players.some((p) => p.id === chooserId)) {
    // اختفى من اللعبة — لاعب تاني يشوف الدورة ببساطة
    return;
  }

  const guild = client.guilds.cache.get(game.guildId);
  const channel: any = guild?.channels.cache.get(game.channelId);
  if (!channel) {
    cleanup(game);
    return;
  }

  game.chooserId = chooserId;
  game.phase = 'choosing';

  try {
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle('🎯 وقعت على...')
      .setDescription(
        `**<@${chooserId}>** — العجلة اختارتك! 💫\n` +
          `اضغط زرار أي لاعب من الباقين لطرده من اللعبة.\n` +
          `⏳ عندك **30 ثانية** — لو ما اخترتش، هتطرَد أنت!`
      )
      .addFields({
        name: `👥 المتبقون (${game.players.length})`,
        value: game.players.map((p, i) => `\`${i + 1}.\` <@${p.id}>`).join('\n').slice(0, 1024),
      })
      .setFooter({ text: '30 ثانية فقط — من يختار بسرعة ما ينخدعش' })
      .setTimestamp();

    const msg = await channel.send({
      content: `🎮 <@${chooserId}> — دورك يا بطل!`,
      embeds: [embed],
      components: kickButtonRows(game, chooserId),
    });
    game.choiceMessageId = msg.id;
    game.choiceTimer = setTimeout(() => void onKickTimeout(client, game.id), CHOICE_SECONDS * 1000);

    // 🤖 لو العجلة وقفت على بوت — يختار فوراً بدل انتظار 30 ثانية
    const chooser = game.players.find((p) => p.id === chooserId);
    if (chooser?.isBot) {
      clearTimeout(game.choiceTimer);
      const others = game.players.filter((p) => p.id !== chooserId);
      if (others.length) {
        const target = others[Math.floor(Math.random() * others.length)];
        game.choiceTimer = setTimeout(() => void eliminatePlayer(client, game, target.id, 'kick'), 1600);
      }
    }
  } catch (err: any) {
    logger.warn(`openKickMenu failed: ${err?.message || err}`);
    cleanup(game);
  }
}

async function onKickTimeout(client: OmniClient, gameId: string): Promise<void> {
  const game = rouletteGames.get(gameId);
  if (!game || game.phase !== 'choosing' || !game.chooserId) return;
  await eliminatePlayer(client, game, game.chooserId, 'timeout');
}

export async function resolveKick(
  client: OmniClient,
  game: RouletteGame,
  targetId: string
): Promise<{ ok: boolean; reason?: string }> {
  if (game.phase !== 'choosing') return { ok: false, reason: 'مش وقت الاختيار دلوقتي' };
  const target = game.players.find((p) => p.id === targetId);
  if (!target) return { ok: false, reason: 'اللاعب ده مابقاش في اللعبة' };
  await eliminatePlayer(client, game, targetId, 'kick');
  return { ok: true };
}

export async function eliminatePlayer(
  client: OmniClient,
  game: RouletteGame,
  targetId: string,
  reason: 'kick' | 'timeout'
): Promise<void> {
  if (game.phase !== 'choosing') return;
  const gameId = game.id;
  clearTimeout(game.choiceTimer);
  game.choiceTimer = undefined;

  const guild = client.guilds.cache.get(game.guildId);
  const channel: any = guild?.channels.cache.get(game.channelId);
  if (!guild || !channel) {
    cleanup(game);
    return;
  }

  const target = game.players.find((p) => p.id === targetId);
  if (!target) {
    // اللاعب خرج بالفعل — نكمل الدورة ببساطة
    game.phase = 'spinning';
    await runRouletteRound(client, game);
    return;
  }

  // عطّل أزرار الاختيار في الرسالة الأصلية
  if (game.choiceMessageId) {
    try {
      const msg = await channel.messages.fetch(game.choiceMessageId);
      await msg.edit({ components: [] });
    } catch {
      /* تجاهل */
    }
  }

  const chooserMention = game.chooserId ? `<@${game.chooserId}>` : 'العجلة';
  const targetMention = `<@${targetId}>`;
  const reasonText =
    reason === 'timeout'
      ? 'ما اختارش أحد خلال 30 ثانية 💀'
      : `${chooserMention} اختاره للطرد 🔫`;

  // DM للمطرود
  try {
    const user = await client.users.fetch(targetId);
    await user
      .send(
        `🎢 تم طردك من لعبة الروليت في **${guild.name}**.\n${reasonText}\n\nيمكنك الانضمام للعبة المقبلة من جديد!`
      )
      .catch(() => {});
  } catch {
    /* DM مغلق — تجاهل */
  }

  const idx = game.players.findIndex((p) => p.id === targetId);
  game.players.splice(idx, 1);
  game.avatarBuffers.splice(idx, 1);

  const remaining = game.players.length;
  await channel
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR)
          .setTitle('💀 طرد!')
          .setDescription(
            `${targetMention} اتطرد من اللعبة! ${reasonText}\n👥 المتبقون الآن: **${remaining}**`
          )
          .setTimestamp(),
      ],
    })
    .catch(() => {});

  if (remaining <= 1) {
    await endRouletteGame(client, game);
    return;
  }

  game.phase = 'spinning';
  game.chooserId = undefined;
  game.choiceMessageId = undefined;
  await runRouletteRound(client, game);
}

// ---------- النهاية ----------

async function endRouletteGame(client: OmniClient, game: RouletteGame): Promise<void> {
  game.phase = 'done';
  clearTimeout(game.choiceTimer);
  clearTimeout(game.startTimer);

  const guild = client.guilds.cache.get(game.guildId);
  const channel: any = guild?.channels.cache.get(game.channelId);
  const winner = game.players[0];
  if (!guild || !channel) {
    cleanup(game);
    return;
  }

  try {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('👑 الفائز في لعبة الروليت!')
          .setDescription(
            `🎉 مبروك **${winner?.id ? `<@${winner.id}>` : 'لا أحد'}** — الناجي الأخير من الروليت! 👑🥁`
          )
          .setTimestamp(),
      ],
    });
  } catch {
    /* تجاهل */
  }
  cleanup(game);
}

function cleanup(game: RouletteGame): void {
  clearTimeout(game.choiceTimer);
  clearTimeout(game.startTimer);
  game.chooserId = undefined;
  game.choiceMessageId = undefined;
  game.choiceTimer = undefined;
  game.startTimer = undefined;
  rouletteGames.delete(game.id);
}

// ---------- انضمام/خروج ----------

// ---------- 🎭 أسماء وهمية يخترعها البوت ----------
const FAKE_FIRST = ['أسد', 'نمر', 'ذئب', 'صقر', 'سيف', 'شبح', 'جبل', 'شهاب', 'فهد', 'حصان', 'عقاب', 'ثور', 'تنين', 'ليث', 'فرهد', 'قاهر', 'عاصف'];
const FAKE_LAST  = ['الصحراء', 'الليل', 'الجبال', 'السماء', 'الرمال', 'الظل', 'البحر', 'اليوم', 'العاصفة', 'الصقور', 'النار', 'الحرية', 'البرق', 'الصبار', 'الفرسان'];
const FAKE_EMOJI = ['🦁', '🐯', '🐺', '🦅', '🔥', '⚡', '🌩️', '🌪️', '⚔️', '🛡️', '💀', '🌟', '☠️', '🦾', '🎯'];

const pickOne = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** 🎲 يخترع العدد المطلوب من اللاعبين الوهميين — اسم من بيت البوت + أفتار من dicebear */
export function inventPlayersForGame(count: number, existing: RoulettePlayer[]): RoulettePlayer[] {
  const free = Math.max(0, MAX_ROULETTE_PLAYERS - existing.length);
  const n = Math.min(Math.max(0, count), free);
  const players: RoulettePlayer[] = [];
  for (let i = 0; i < n; i++) {
    const first = pickOne(FAKE_FIRST);
    const last = pickOne(FAKE_LAST);
    const emoji = pickOne(FAKE_EMOJI);
    const name = `${first} ${last} ${emoji}`;
    const id = `fake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${i}`;
    players.push({
      id,
      username: name.slice(0, 32),
      avatarUrl: `https://api.dicebear.com/9.x/adventurer-neutral/png?seed=${encodeURIComponent(name)}&size=64&backgroundColor=e3b6ff`,
      isBot: true,
    });
  }
  return players;
}

export function addToRouletteLobby(
  gameId: string,
  player: RoulettePlayer
): { ok: boolean; reason?: string; game?: RouletteGame } {
  const game = rouletteGames.get(gameId);
  if (!game) return { ok: false, reason: 'انتهت اللعبة أو لم تبدأ' };
  if (game.phase !== 'lobby') return { ok: false, reason: 'بدأت اللعبة بالفعل' };
  if (game.players.some((p) => p.id === player.id)) return { ok: false, reason: 'أنت مشارك بالفعل!' };
  if (game.players.length >= MAX_ROULETTE_PLAYERS) return { ok: false, reason: 'اللعبة ممتلئة (25 كحد أقصى)' };
  game.players.push(player);
  return { ok: true, game };
}

export function removeFromRouletteLobby(
  gameId: string,
  userId: string
): { ok: boolean; reason?: string; game?: RouletteGame } {
  const game = rouletteGames.get(gameId);
  if (!game) return { ok: false, reason: 'انتهت اللعبة أو لم تبدأ' };
  if (game.phase !== 'lobby') return { ok: false, reason: 'بدأت اللعبة — مفيش خروج' };
  const idx = game.players.findIndex((p) => p.id === userId);
  if (idx === -1) return { ok: false, reason: 'لم تنضم للعبة أصلاً' };
  game.players.splice(idx, 1);
  return { ok: true, game };
}
