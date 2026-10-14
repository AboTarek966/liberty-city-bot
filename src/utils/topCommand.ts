// ============================================
// Liberty City Bot - أمر النصي `top`
//   top            → الأسبوعي (الافتراضي)
//   top يومي       → يومي
//   top اسبوعي     → أسبوعي
//   top شهري       → شهري
//   top اجمالي     → إجمالي
// يعمل بدون بادئة وبدون منشن — مثل الصورة المرجعية
// ============================================

import { Message } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from './helpers';
import {
  buildLeaderboardPage,
  LBPeriod,
  LBType,
  LBLimit,
} from '../commands/utility/leaderboard';

const logger = createLogger('TopCommand');

// --------------------------------------------
// تطبيع النص العربي/الإنجليزي للمقارنة
// --------------------------------------------
function norm(s: string): string {
  return s
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // تشكيل + تطويل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

const RAW_TRIGGERS = [
  'top', 'tob', 'top10', 'tob10', 'توب', 'توب10',
  'ليدر', 'ليدربورد', 'leaderboard', 'toboard',
  'rank', 'ranks', 'ranking',
];
const TRIGGERS = new Set(RAW_TRIGGERS.map(norm));

const RAW_PERIODS: Record<string, LBPeriod> = {
  day: 'day', daily: 'day', يومي: 'day', يوم: 'day', اليوم: 'day', يوميا: 'day',
  week: 'week', weekly: 'week', اسبوعي: 'week', اسبوع: 'week', الاسبوع: 'week',
  اسبوعيا: 'week', ويكلي: 'week',
  month: 'month', monthly: 'month', شهري: 'month', شهر: 'month', الشهر: 'month',
  شهريا: 'month',
  total: 'total', all: 'total', اجمالي: 'total', الاجمالي: 'total', اجمالى: 'total',
  كلي: 'total', عام: 'total', الافضل: 'total', الاعلى: 'total',
};
const PERIODS: Record<string, LBPeriod> = {};
for (const [k, v] of Object.entries(RAW_PERIODS)) PERIODS[norm(k)] = v;

const RAW_TYPES: Record<string, LBType> = {
  all: 'all', الكل: 'all', شامل: 'all',
  messages: 'messages', message: 'messages', شات: 'messages', دردشة: 'messages',
  دردشه: 'messages', رسائل: 'messages', رسالة: 'messages', كلام: 'messages',
  chat: 'messages', text: 'messages', نص: 'messages',
  voice: 'voiceMinutes', voiceMinutes: 'voiceMinutes', صوت: 'voiceMinutes',
  الصوت: 'voiceMinutes', صوتي: 'voiceMinutes', صوتيه: 'voiceMinutes', voiceTime: 'voiceMinutes',
  vocal: 'voiceMinutes', micro: 'voiceMinutes', مايك: 'voiceMinutes',
};
const TYPES: Record<string, LBType> = {};
for (const [k, v] of Object.entries(RAW_TYPES)) TYPES[norm(k)] = v;

// --------------------------------------------
// كولداون بسيط (يمنع إغراق القناة بالتوب)
// --------------------------------------------
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 4000;

function onCooldown(guildId: string, userId: string): boolean {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const until = cooldowns.get(key) || 0;
  if (now < until) return true;
  cooldowns.set(key, now + COOLDOWN_MS);

  // تنظيف دوري
  if (cooldowns.size > 500) {
    for (const [k, v] of cooldowns) if (v < now) cooldowns.delete(k);
  }
  return false;
}

// --------------------------------------------
// المعالج
// --------------------------------------------
export async function handleTopCommand(
  message: Message,
  client: LibertyClient
): Promise<boolean> {
  try {
    if (!message.guild || message.author.bot) return false;

    const content = message.content || '';
    if (content.length > 80) return false; // جملة طويلة = ليست أمراً

    const parts = content.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0 || parts.length > 5) return false;

    // الكلمة الأولى يجب أن تكون محفّزاً معروفاً
    if (!TRIGGERS.has(norm(parts[0]))) return false;

    let period: LBPeriod = 'week';
    let type: LBType = 'all';
    let limit: LBLimit = 'all';

    // بقية الكلمات: فترة / نوع — كلمة غريبة = ليست أمراً (لا نخطف جملة عادية)
    for (const raw of parts.slice(1)) {
      const w = norm(raw);
      if (PERIODS[w]) period = PERIODS[w];
      else if (TYPES[w]) type = TYPES[w];
      else if (w === '10') limit = '10';
      else if (w === '25') limit = '25';
      else return false;
    }

    if (onCooldown(message.guild.id, message.author.id)) return false;

    const page = await buildLeaderboardPage(
      client,
      message.guild,
      type,
      period,
      limit,
      1
    );

    await message.reply({ embeds: [page.embed], components: page.components });
    return true;
  } catch (error) {
    logger.error('Error in top command:', error);
    return false;
  }
}

export default handleTopCommand;
