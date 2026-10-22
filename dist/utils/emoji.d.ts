import { Guild } from 'discord.js';
/**
 * 🎨 تحويل اختصارات إيموجي السيرفر (:اسم:) إلى إيموجي حقيقي <:اسم:id>
 *    ديسكورد لا يحوّل الاختصارات تلقائياً في رسائل البوت (تظهر كنص خام مثل ":اسم:") —
 *    نبحث في كاش إيموجي السيرفر ونستبدلها، وما لا يُوجد في السيرفر يبقى نصاً كما هو
 *    (إيموجي سيرفر آخر لا يظهر — لازم يكون من نفس السيرفر)
 */
export declare function resolveEmojiShortcodes(text: string, guild: Guild | null): string;
//# sourceMappingURL=emoji.d.ts.map