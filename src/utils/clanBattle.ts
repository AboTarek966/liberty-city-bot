// ============================================
// Omni Bot - 🛡️ مساعد مسابقات العشائر
// ============================================

import path from 'path';
import fs from 'fs';
import { EmbedBuilder } from 'discord.js';
import { createLogger } from './helpers';

const logger = createLogger('ClanBattle');

// pallete: — للبراهين والأعمدة
const GOLD = '#f1c40f';
const SILVER = '#c0c0c0';
const BRONZE = '#cd7f32';
const BG_DARK = '#0b1020';
const BG_SURFACE = '#141b2d';
const TEXT_LIGHT = '#f8fafc';
const TEXT_MUTED = '#94a3b8';

// يحدد 🏆 الفائز — الاحتفاظ بترتيب الصورة للعشائر
export interface BattleWinnerInfo {
  id: string;
  name: string;
  memberIds: string[];
  messages: number;
  voiceMinutes: number;
  score: number;
}

function ensureFonts(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GlobalFonts } = require('@napi-rs/canvas');
    const dir = path.join(__dirname, '..', '..', 'assets', 'fonts');
    const needed = ['NotoSansArabic-Regular.ttf', 'NotoSansArabic-Bold.ttf', 'NotoSans-Regular.ttf', 'NotoSans-Bold.ttf'];
    if (needed.every((f) => fs.existsSync(path.join(dir, f)))) {
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSansArabic-Regular.ttf'), 'OmniArabic');
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSansArabic-Bold.ttf'), 'OmniArabic');
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSans-Regular.ttf'), 'OmniSans');
      GlobalFonts.registerFromPath(path.join(dir, 'NotoSans-Bold.ttf'), 'OmniSans');
      return true;
    }
  } catch (err: any) {
    logger.warn(`registerFont failed — ${err?.message || err}`);
  }
  return false;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** يجمع إحصائيات العشيرة خلال فترة المسابقة من وثائق day stats */
export async function sumClanWindowActivity(
  guildId: string,
  memberIds: string[],
  from: Date,
  to: Date
): Promise<{ messages: number; voiceMinutes: number; voiceJoins: number }> {
  if (!memberIds.length) return { messages: 0, voiceMinutes: 0, voiceJoins: 0 };
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  const { ActivityStats } = await import('../handlers/ActivityTracker');
  const docs = await ActivityStats.find({
    guildId,
    userId: { $in: memberIds },
    period: 'day',
    date: { $gte: fromKey, $lte: toKey },
  }).lean();
  let messages = 0,
    voiceMinutes = 0,
    voiceJoins = 0;
  for (const d of docs) {
    messages += d.messages || 0;
    voiceMinutes += d.voiceMinutes || 0;
    voiceJoins += d.voiceJoins || 0;
  }
  return { messages, voiceMinutes, voiceJoins };
}

/** ينشئ صورة إعلان فائز مسابقة عشائرية — PNG */
export async function renderClanBattleWinner(
  guildName: string,
  winner: BattleWinnerInfo,
  runnersUp: BattleWinnerInfo[]
): Promise<Buffer> {
  ensureFonts();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createCanvas } = require('@napi-rs/canvas');

  const width = 1100;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // خلفية
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, BG_DARK);
  bg.addColorStop(1, BG_SURFACE);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // توهج القمة (ذهبي)
  const glow = ctx.createRadialGradient(width / 2, 200, 10, width / 2, 200, 280);
  glow.addColorStop(0, 'rgba(241, 196, 15, 0.55)');
  glow.addColorStop(1, 'rgba(241, 196, 15, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // عنوان صغير
  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = 'Regular 26px OmniArabic';
  ctx.fillText('⚔️ مسابقة العشائر 🏰', width / 2, 70);

  // الجائزة الكبيرة — الكرون (مرسوم يدوياً)
  drawCrown(ctx, width / 2, 200, 120);

  // اسم الفائز
  ctx.fillStyle = GOLD;
  ctx.font = 'Bold 64px OmniArabic';
  ctx.fillText(winner.name.slice(0, 28), width / 2, 390);

  ctx.fillStyle = TEXT_LIGHT;
  ctx.font = 'Regular 26px OmniArabic';
  ctx.fillText('الفائز في المسابقة', width / 2, 440);

  // إحصائيات الفائز
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = 'Regular 24px OmniArabic';
  const stats = `الرسائل: ${winner.messages.toLocaleString()}  ·  صوت: ${Math.floor(winner.voiceMinutes / 60)}س ${winner.voiceMinutes % 60}د  ·  الأعضاء: ${winner.memberIds.length}`;
  ctx.fillText(stats, width / 2, 500);

  // المركز الثاني والثالث (إن وجدوا)
  const others = runnersUp.slice(0, 2);
  ctx.textAlign = 'center';
  if (others.length) {
    ctx.fillStyle = SILVER;
    ctx.font = 'Regular 22px OmniArabic';
    ctx.fillText('المركز الثاني', width / 2, 570);
    ctx.fillStyle = TEXT_LIGHT;
    ctx.fillText(others[0].name.slice(0, 24), width / 2, 600);
    if (others[1]) {
      ctx.fillStyle = BRONZE;
      ctx.fillText('المركز الثالث', width / 2, 630);
      ctx.fillStyle = TEXT_LIGHT;
      ctx.fillText(others[1].name.slice(0, 24), width / 2, 660);
    }
  }

  return canvas.toBuffer('image/png');
}

function drawCrown(ctx: any, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = '#d4ac0d';
  ctx.lineWidth = 4;

  // جسم التاج
  ctx.beginPath();
  ctx.moveTo(-size / 2, size / 3);
  ctx.lineTo(-size / 2, -size / 6);
  ctx.lineTo(-size / 4, size / 8);
  ctx.lineTo(0, -size / 2);
  ctx.lineTo(size / 4, size / 8);
  ctx.lineTo(size / 2, -size / 6);
  ctx.lineTo(size / 2, size / 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // نقاط الكستاش
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(-size / 4, size / 6, 6, 0, Math.PI * 2);
  ctx.arc(0, -size / 6, 7, 0, Math.PI * 2);
  ctx.arc(size / 4, size / 6, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** معالجة المسابقات المنتهية — تُستدعى دورياً من Ready */
export async function processEndedClanBattles(client: any): Promise<void> {
  try {
    const { ClanBattle } = await import('../models');
    const { Clan } = await import('../models');

    const now = new Date();
    const ended = await ClanBattle.find({ status: 'active', endsAt: { $lte: now } });

    for (const battle of ended) {
      try {
        let winner: BattleWinnerInfo | undefined;
        let runnersUp: BattleWinnerInfo[] = [];
        const scores: BattleWinnerInfo[] = [];

        for (const clanId of battle.clanIds) {
          const clan = await Clan.findOne({ _id: clanId, active: true }).lean();
          if (!clan) continue;
          const stats = await sumClanWindowActivity(battle.guildId, clan.members, battle.startsAt, battle.endsAt);
          scores.push({
            id: String(clan._id),
            name: clan.name,
            memberIds: clan.members,
            messages: stats.messages,
            voiceMinutes: stats.voiceMinutes,
            score: stats.messages + stats.voiceMinutes * 10,
          });
        }

        scores.sort((a, b) => b.score - a.score);

        if (scores.length) {
          winner = scores[0];
          runnersUp = scores.slice(1);
        }

        // حفظ النتيجة
        battle.status = 'ended';
        battle.winnerClanId = winner?.id;
        battle.winnerMemberIds = winner?.memberIds || [];
        battle.endedAt = now;
        await battle.save();

        // إرسال إعلان الفائز
        if (winner) {
          try {
            const { AttachmentBuilder } = await import('discord.js');
            const image = await renderClanBattleWinner(client?.guilds?.cache?.get(battle.guildId)?.name || 'Omni Store', winner, runnersUp);
            const file = new AttachmentBuilder(image, { name: 'battle-winner.png' });

            const mentions = (winner.memberIds || []).slice(0, 60).map((id: string) => `<@${id}>`).join(' ');
            const embed = new EmbedBuilder()
              .setColor(GOLD)
              .setTitle('🏆 انتهت مسابقة العشائر!')
              .setDescription(
                `الفائز: **${winner.name}**\nالرسائل: ${winner.messages} · الصوت: ${Math.floor(winner.voiceMinutes / 60)}س ${winner.voiceMinutes % 60}د · الأعضاء: ${winner.memberIds.length}`
              )
              .setTimestamp();

            const channelId = battle.channelId;
            const guild = client?.guilds?.cache?.get(battle.guildId);
            const channel: any = channelId ? guild?.channels?.cache?.get(channelId) : guild?.systemChannel || guild?.channels?.cache?.find((c: any) => c.type === 0 /* GuildText */);
            if (channel?.isTextBased?.()) {
              await channel.send({
                content: mentions ? `🎉 مبروك ${mentions}` : '🎉 مبروك للفائزين!',
                embeds: [embed],
                files: [file],
              });
            }
          } catch (err: any) {
            logger.warn(`clan battle announcement failed: ${err?.message || err}`);
          }
        }

        logger.info(`Clan battle ended in ${battle.guildId}: winner=${winner?.name || 'none'}`);
      } catch (err: any) {
        logger.error(`processEndedClanBattle failed for ${battle._id}: ${err?.message || err}`);
      }
    }
  } catch (err: any) {
    logger.error(`processEndedClanBattles failed: ${err?.message || err}`);
  }
}
