import { Message } from 'discord.js';
import { OmniClient } from '../OmniClient';
import { normalizeArabic } from './abuseDetector';

/**
 * هل الإساءة موجهة فعلاً للبوت (وليس ذكراً عرضياً لـ "بوت" في جملة عن سيرفر/شيء آخر)؟
 * - منشن/ردّ على البوت → نعم (مباشر).
 * - سب صريح (hard slur) → نعم (حتى بدون منشن).
 * - خلاف ذلك (مصطلح "мягкий") → نعم فقط إذا ظهر مصطلح الإساءة بالقرب (≤5 كلمات) من ذكر البوت.
 */
export function isAbuseDirectedAtBot(message: Message, abuseTerm: string, client: OmniClient): boolean {
  const meId = client.user?.id;
  // منشن / ردّ مباشر
  if (meId && message.mentions?.users?.has(meId)) return true;
  if (meId && message.mentions?.members?.has(meId)) return true;
  if (meId && message.reference?.messageId) {
    const replied = message.mentions?.repliedUser;
    if (replied?.id === meId) return true;
  }

  const content = message.content || '';
  const normalized = normalizeArabic(content);
  const tokens = normalized.split(/\s+/).filter(Boolean);

  // positions of bot-name tokens
  const botPositions: number[] = [];
  tokens.forEach((t, i) => {
    if (/(^|[^a-z])?(bot|بوت|بوتك|بوتي|omni|اومني|ليبرتي|liberty|liberti)([^a-z]|$)/i.test(t)) {
      botPositions.push(i);
    }
  });

  // positions of the abuse term (normalized)
  const termNorm = normalizeArabic(abuseTerm);
  const termPositions: number[] = [];
  tokens.forEach((t, i) => {
    if (termNorm && (t === termNorm || t.includes(termNorm) || termNorm.includes(t))) {
      termPositions.push(i);
    }
  });

  if (botPositions.length === 0 || termPositions.length === 0) {
    // لا ذكر للبوت → اعتمد على containsHardSlur (يُفحص في handleBotAbuse)
    return false;
  }

  // تحقق من القرب: ≤5 كلمات
  for (const bp of botPositions) {
    for (const tp of termPositions) {
      if (Math.abs(bp - tp) <= 5) return true;
    }
  }
  return false;
}