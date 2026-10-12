// ============================================
// Liberty City Bot - AFK System (وضع عدم الوجود)
// - /afk [السبب] يفعّل AFK (أو يلغيه إذا كنت AFK)
// - أول رسالة لك تُلغي AFK تلقائياً + رسالة عودة
// - من يmention شخصاً في AFK يخبره البوت بالسبب
// ذاكرة مؤقتة سريعة حتى لا تُبطئ معالجة كل رسالة
// ============================================

import { UserAFK } from '../models';
import { createLogger } from './helpers';

const logger = createLogger('AFK');

export interface AfkEntry {
  reason: string;
  since: number; // timestamp ms
}

const TTL = 30_000; // 30 ثانية
const cache = new Map<string, { entry: AfkEntry | null; ts: number }>();

const keyOf = (guildId: string, userId: string) => `${guildId}:${userId}`;

function cleanup(): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.ts > TTL) cache.delete(k);
  }
}

// جلب حالة AFK (مع ذاكرة مؤقتة)
export async function getAFK(guildId: string, userId: string): Promise<AfkEntry | null> {
  cleanup();
  const k = keyOf(guildId, userId);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.ts < TTL) return hit.entry;

  let entry: AfkEntry | null = null;
  try {
    const doc = await UserAFK.findOne({ guildId, userId }).lean();
    if (doc) entry = { reason: doc.reason || 'AFK', since: new Date(doc.since).getTime() };
  } catch (e: any) {
    logger.warn(`getAFK failed: ${e.message}`);
  }
  cache.set(k, { entry, ts: Date.now() });
  return entry;
}

// تفعيل AFK
export async function setAFK(guildId: string, userId: string, reason: string): Promise<AfkEntry> {
  const entry: AfkEntry = { reason: reason || 'AFK', since: Date.now() };
  await UserAFK.updateOne(
    { guildId, userId },
    { $set: { reason: entry.reason, since: new Date(entry.since) } },
    { upsert: true }
  ).catch(e => logger.warn(`setAFK failed: ${e.message}`));
  cache.set(keyOf(guildId, userId), { entry, ts: Date.now() });
  return entry;
}

// إلغاء AFK
export async function removeAFK(guildId: string, userId: string): Promise<boolean> {
  cache.set(keyOf(guildId, userId), { entry: null, ts: Date.now() });
  try {
    const res = await UserAFK.deleteOne({ guildId, userId });
    return (res.deletedCount || 0) > 0;
  } catch (e: any) {
    logger.warn(`removeAFK failed: ${e.message}`);
    return false;
  }
}
