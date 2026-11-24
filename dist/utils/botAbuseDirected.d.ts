import { Message } from 'discord.js';
import { OmniClient } from '../OmniClient';
/**
 * هل الإساءة موجهة فعلاً للبوت (وليس ذكراً عرضياً لـ "بوت" في جملة عن سيرفر/شيء آخر)؟
 * - منشن/ردّ على البوت → نعم (مباشر).
 * - سب صريح (hard slur) → نعم (حتى بدون منشن).
 * - خلاف ذلك (مصطلح "мягкий") → نعم فقط إذا ظهر مصطلح الإساءة بالقرب (≤5 كلمات) من ذكر البوت.
 */
export declare function isAbuseDirectedAtBot(message: Message, abuseTerm: string, client: OmniClient): boolean;
//# sourceMappingURL=botAbuseDirected.d.ts.map