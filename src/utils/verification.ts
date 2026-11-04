// ============================================
// Omni Bot - Verification Helpers
// ============================================
// كابتشا رياضية قصيرة العمر + سجل تدقيق للتوثيق.

import { Guild, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { randomInt } from 'crypto';
import { getGuildSettings } from '../models';
import { createLogger } from './helpers';
import { Colors } from './embeds';

const logger = createLogger('Verification');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const BLOCK_MS = 10 * 60 * 1000;

interface Challenge {
  answer: number;
  attempts: number;
  expiresAt: number;
}

const challenges = new Map<string, Challenge>();
const blockedUntil = new Map<string, number>();

export function getAccountAgeDays(user: { createdTimestamp: number }): number {
  return Math.floor((Date.now() - user.createdTimestamp) / 86_400_000);
}

export function cleanupVerificationState(): void {
  const now = Date.now();
  for (const [key, value] of challenges) {
    if (value.expiresAt <= now) challenges.delete(key);
  }
  for (const [key, until] of blockedUntil) {
    if (until <= now) blockedUntil.delete(key);
  }
}

export interface ChallengeResult {
  ok: boolean;
  blocked?: boolean;
  blockedMinutes?: number;
  question?: string;
  expiresInMinutes?: number;
}

export function createVerificationChallenge(userId: string): ChallengeResult {
  cleanupVerificationState();

  const until = blockedUntil.get(userId);
  if (until && until > Date.now()) {
    return {
      ok: false,
      blocked: true,
      blockedMinutes: Math.max(1, Math.ceil((until - Date.now()) / 60_000)),
    };
  }

  const a = randomInt(2, 20);
  const b = randomInt(1, 15);
  const useSubtraction = randomInt(0, 2) === 1 && a > b;
  const answer = useSubtraction ? a - b : a + b;
  const question = useSubtraction ? `${a} − ${b} = ؟` : `${a} + ${b} = ؟`;

  challenges.set(userId, {
    answer,
    attempts: 0,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });

  return { ok: true, question, expiresInMinutes: CHALLENGE_TTL_MS / 60_000 };
}

export interface AnswerResult {
  status: 'ok' | 'wrong' | 'expired' | 'blocked';
  attemptsLeft?: number;
  blockedMinutes?: number;
}

export function consumeVerificationChallenge(userId: string, rawAnswer: string): AnswerResult {
  const until = blockedUntil.get(userId);
  if (until && until > Date.now()) {
    return {
      status: 'blocked',
      blockedMinutes: Math.max(1, Math.ceil((until - Date.now()) / 60_000)),
    };
  }

  const challenge = challenges.get(userId);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    challenges.delete(userId);
    return { status: 'expired' };
  }

  const normalized = rawAnswer
    .trim()
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^\d-]/g, '');
  const answer = Number(normalized);

  if (!Number.isFinite(answer) || answer !== challenge.answer) {
    challenge.attempts += 1;
    if (challenge.attempts >= MAX_ATTEMPTS) {
      challenges.delete(userId);
      blockedUntil.set(userId, Date.now() + BLOCK_MS);
      return { status: 'blocked', blockedMinutes: BLOCK_MS / 60_000 };
    }
    return { status: 'wrong', attemptsLeft: MAX_ATTEMPTS - challenge.attempts };
  }

  challenges.delete(userId);
  return { status: 'ok' };
}

// --------------------------------------------
// Role granting
// --------------------------------------------
export interface GrantResult {
  ok: boolean;
  message: string;
}

export async function grantVerifiedRole(
  guild: Guild,
  member: GuildMember,
  verification: {
    roleId?: string;
    quarantineRoleId?: string;
  },
  reason = 'توثيق ذاتي بالزر'
): Promise<GrantResult> {
  const roleId = verification.roleId;
  if (!roleId) return { ok: false, message: '❌ رول التوثيق غير محدد — أبلغ الإدارة' };

  const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) return { ok: false, message: '❌ رول التوثيق لم يعد موجوداً — أبلغ الإدارة' };

  const botMember = guild.members.me;
  if (botMember && botMember.roles.highest.position <= role.position) {
    return {
      ok: false,
      message: '❌ لا أستطيع إعطاء الرول — **ارفع رتبة البوت أعلى من رول التوثيق**',
    };
  }

  try {
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role, reason);
    }

    if (verification.quarantineRoleId && member.roles.cache.has(verification.quarantineRoleId)) {
      const quarantine = guild.roles.cache.get(verification.quarantineRoleId);
      if (quarantine && botMember && botMember.roles.highest.position > quarantine.position) {
        await member.roles.remove(quarantine, 'إزالة رول الحجر بعد التوثيق').catch(() => {});
      }
    }

    return { ok: true, message: `🎉 **تم توثيقك بنجاح!**\nيمكنك الآن التفاعل في السيرفر — أهلاً بك ${member}` };
  } catch (error: any) {
    return { ok: false, message: `❌ فشل إعطاء الرول: \`${error.message}\` — تحقق من صلاحيات البوت` };
  }
}

// --------------------------------------------
// Audit log
// --------------------------------------------
export type VerificationLogAction = 'success' | 'fail' | 'blocked' | 'info';

export async function logVerification(
  guild: Guild,
  member: GuildMember,
  action: VerificationLogAction,
  details: string
): Promise<void> {
  try {
    const settings = await getGuildSettings(guild.id);
    const channelId =
      settings.verification?.logChannelId || settings.protection?.logChannel || undefined;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel || !channel.isTextBased()) return;

    const palette: Record<VerificationLogAction, any> = {
      success: Colors.success,
      fail: Colors.warning,
      blocked: Colors.error,
      info: Colors.info,
    };
    const titles: Record<VerificationLogAction, string> = {
      success: '✅ توثيق ناجح',
      fail: '⚠️ فشل التوثيق',
      blocked: '⛔ محاولة محظورة',
      info: 'ℹ️ توثيق',
    };

    const embed = new EmbedBuilder()
      .setTitle(titles[action])
      .setColor(palette[action])
      .addFields(
        { name: '👤 العضو', value: `${member} \`${member.id}\``, inline: true },
        { name: '🕰️ عمر الحساب', value: `${getAccountAgeDays(member.user)} يوم`, inline: true },
        { name: '📝 التفاصيل', value: details.slice(0, 1024), inline: false }
      )
      .setFooter({ text: `${guild.name} • Verification` })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (error: any) {
    logger.debug(`Verification log failed: ${error.message}`);
  }
}
