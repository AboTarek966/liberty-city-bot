// ============================================
// Liberty City Bot - Alias Cache (ذاكرة اختصارات الأوامر)
// تمنع استعلام MongoDB في كل رسالة — تحميل كامل اختصارات
// السيرفر مرة واحدة كل 30 ثانية + إلغاء فوري عند الإضافة/الحذف
// ============================================

import { CommandAlias, ICommandAlias } from '../models/CommandAlias';
import { createLogger } from './helpers';

const logger = createLogger('AliasCache');

const TTL = 30_000; // 30 ثانية
const cache = new Map<string, { map: Map<string, ICommandAlias[]>; ts: number }>();

// كل الاختصارات في السيرفر (alias → قائمة أوامر مرتبطة به)
async function loadGuildAliases(guildId: string): Promise<Map<string, ICommandAlias[]>> {
  const docs = await CommandAlias.find({ guildId }).catch(() => [] as ICommandAlias[]);
  const map = new Map<string, ICommandAlias[]>();
  for (const doc of docs) {
    const list = map.get(doc.alias) || [];
    list.push(doc);
    map.set(doc.alias, list);
  }
  return map;
}

/**
 * جلب الأوامر المرتبطة باختصار معين.
 * نفس الاختصار قد يرتبط بأكثر من أمر (نظام التبديل/Toggle).
 */
export async function getAliasesForShortcut(
  guildId: string,
  shortcut: string
): Promise<ICommandAlias[]> {
  let entry = cache.get(guildId);
  if (!entry || Date.now() - entry.ts > TTL) {
    try {
      const map = await loadGuildAliases(guildId);
      entry = { map, ts: Date.now() };
      cache.set(guildId, entry);
    } catch (e: any) {
      logger.warn(`Alias cache load failed for ${guildId}: ${e.message}`);
      return [];
    }
  }
  return entry.map.get(shortcut) || [];
}

// إلغاء الذاكرة المؤقتة لسيرفر (يُستدعى عند الإضافة/الحذف)
export function invalidateAliasCache(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}

/**
 * كل اختصارات السيرفر في خريطة واحدة (alias → أوامر).
 * تُستخدم لمطابقة اختصارات متعددة الكلمات (تحتوي مسافات).
 */
export async function getAllGuildAliases(guildId: string): Promise<Map<string, ICommandAlias[]>> {
  let entry = cache.get(guildId);
  if (!entry || Date.now() - entry.ts > TTL) {
    try {
      const map = await loadGuildAliases(guildId);
      entry = { map, ts: Date.now() };
      cache.set(guildId, entry);
    } catch (e: any) {
      logger.warn(`Alias cache load failed for ${guildId}: ${e.message}`);
      return new Map();
    }
  }
  return entry.map;
}
