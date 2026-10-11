// ============================================
// Liberty City Bot - Snipe Cache (سنايب)
// حفظ آخر الرسائل المحذوفة لكل قناة مؤقتاً (15 دقيقة)
// يُستخدم بأمر /snipe أو أي اختصار مضاف له
// ============================================

import { createLogger } from './helpers';

const logger = createLogger('Snipe');

export interface SnipeEntry {
  authorId: string;
  authorTag: string;
  authorAvatar?: string | null;
  content: string;
  embedCount: number;
  attachments: Array<{ name: string; url: string }>;
  channelId: string;
  postedAt: number;
  deletedAt: number;
  pinned: boolean;
}

const store = new Map<string, SnipeEntry[]>(); // `${guildId}:${channelId}` → الأحدث أولاً

const TTL_MS = 15 * 60 * 1000; // 15 دقيقة
const MAX_PER_CHANNEL = 5; // آخر 5 رسائل لكل قناة

/** تسجيل رسالة محذوفة (يستدعيها حدث messageDelete) */
export function recordDeletedMessage(message: any): void {
  try {
    if (!message?.guild?.id || !message.channelId) return;

    const content: string = typeof message.content === 'string' ? message.content : '';
    const attachments = Array.from((message.attachments?.values?.() || []) as Iterable<any>)
      .slice(0, 5)
      .map((a: any) => ({ name: a.name || 'مرفق', url: a.url }))
      .filter((a: any) => !!a.url);
    const embedCount = message.embeds?.size ?? (Array.isArray(message.embeds) ? message.embeds.length : 0);

    // لا شيء قابل للاسترجاع
    if (!content.trim() && attachments.length === 0 && !embedCount) return;

    const entry: SnipeEntry = {
      authorId: message.author?.id || '0',
      authorTag: message.author?.tag || message.author?.username || 'غير معروف',
      authorAvatar: message.author?.displayAvatarURL?.() || null,
      content: content.trim() || (attachments.length ? '' : ' *(رسالة بدون نص — إمبد)*'),
      embedCount,
      attachments,
      channelId: message.channelId,
      postedAt: message.createdTimestamp || Date.now(),
      deletedAt: Date.now(),
      pinned: !!message.pinned,
    };

    const key = `${message.guild.id}:${message.channelId}`;
    const list = (store.get(key) || []).filter(e => Date.now() - e.deletedAt < TTL_MS);
    list.unshift(entry);
    if (list.length > MAX_PER_CHANNEL) list.length = MAX_PER_CHANNEL;
    store.set(key, list);
    logger.debug(`Sniped deleted message in ${message.guild.id}/${message.channelId}`);
  } catch (error) {
    logger.warn('recordDeletedMessage failed:', error);
  }
}

/** جلب رسالة محذوفة — index=0 الأحدث (الأقدم حتى 4) */
export function getSnipedMessage(guildId: string, channelId: string, index = 0): SnipeEntry | null {
  const key = `${guildId}:${channelId}`;
  const list = (store.get(key) || []).filter(e => Date.now() - e.deletedAt < TTL_MS);
  if (list.length === 0) return null;
  store.set(key, list);
  return list[index] || null;
}

/** عدد الرسائل المحفوظة حالياً لهذه القناة */
export function getSnipeCount(guildId: string, channelId: string): number {
  const key = `${guildId}:${channelId}`;
  const list = (store.get(key) || []).filter(e => Date.now() - e.deletedAt < TTL_MS);
  store.set(key, list);
  return list.length;
}
