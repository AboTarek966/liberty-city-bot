// ============================================
// Liberty City Bot - Emoji utils
// تحويل اختصارات إيموجي السيرفر (:اسم:) إلى إيموجي حقيقي
// يُستخدم في كل الرسائل التلقائية (الردود التلقائية، الترحيب، المغادرة، ردود الذكاء)
// ============================================

import { Guild } from 'discord.js';

/**
 * 🎨 تحويل اختصارات إيموجي السيرفر (:اسم:) إلى إيموجي حقيقي <:اسم:id>
 *    ديسكورد لا يحوّل الاختصارات تلقائياً في رسائل البوت (تظهر كنص خام مثل ":اسم:") —
 *    نبحث في كاش إيموجي السيرفر ونستبدلها، وما لا يُوجد في السيرفر يبقى نصاً كما هو
 *    (إيموجي سيرفر آخر لا يظهر — لازم يكون من نفس السيرفر)
 */
export function resolveEmojiShortcodes(text: string, guild: Guild | null): string {
  if (!guild || !text.includes(':')) return text;
  const emojis = guild.emojis.cache;
  if (!emojis.size) return text;
  return text.replace(/:([\w-]{1,32}):/g, (match, name: string) => {
    const emoji = emojis.find((e) => e.name?.toLowerCase() === name.toLowerCase());
    if (!emoji) return match;
    return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
  });
}
