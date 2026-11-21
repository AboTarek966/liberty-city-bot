// ============================================
// Omni Bot - 👑 تحقق من ملكية البوت
// يحدد المالك تلقائياً من بيئة العمل أو من مالك التطبيق في Discord
// ============================================

import type { Client, User, Team, Guild } from 'discord.js';

let cachedOwnerIds: string[] | null = null;

/**
 * ⚡ فحص متزامن: هل المستخدم مالك/مطوّر البوت؟
 * يفحص OWNER_ID وDEVELOPER_USER_ID، وأيضاً مالك التطبيق المخزّن بعد الإقلاع.
 * لا يحتاج client ولا اتصالاً بديسكورد وقت الاستدعاء.
 */
export function isEnvBotOwner(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const id = String(userId).trim();
  if (!id) return false;
  const ids = [
    process.env.OWNER_ID,
    process.env.DEVELOPER_USER_ID,
    ...(cachedOwnerIds ?? []),
  ];
  return ids
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .some((ownerId) => ownerId === id);
}

function collectOwnerIds(owner: User | Team | null): string[] {
  if (!owner) return [];
  if ('members' in owner) {
    return [owner.ownerId, ...Array.from(owner.members.values()).map((m) => m.user.id)].filter(
      (v): v is string => !!v
    );
  }
  return [owner.id];
}

export async function getBotOwnerIds(client: Client): Promise<string[]> {
  const ids = new Set<string>();
  if (process.env.OWNER_ID) ids.add(process.env.OWNER_ID);
  if (process.env.DEVELOPER_USER_ID) ids.add(process.env.DEVELOPER_USER_ID);

  if (cachedOwnerIds) cachedOwnerIds.forEach((id) => ids.add(id));
  else if (client.application) {
    let owner = client.application.owner;
    if (!owner) {
      try {
        owner = (await client.application.fetch()).owner;
      } catch {}
    }
    cachedOwnerIds = collectOwnerIds(owner);
    cachedOwnerIds.forEach((id) => ids.add(id));
  }

  return Array.from(ids);
}

export async function isBotOwner(client: Client, userId: string): Promise<boolean> {
  return (await getBotOwnerIds(client)).includes(userId);
}

/**
 * 👑 مالك/مطوّر البوت أو مالك السيرفر — البوابة الموحّدة للصلاحيات الإدارية العليا.
 * تُستخدم حيث يجب أن يتصرف المطوّر تماماً مثل صاحب السيرفر حتى بدون ملكية.
 */
export async function isBotOwnerOrGuildOwner(
  client: Client,
  guild: Guild | null | undefined,
  userId: string
): Promise<boolean> {
  if (!userId) return false;
  if (guild && String(guild.ownerId) === String(userId)) return true;
  return isBotOwner(client, userId);
}

/** نسخة متزامنة تعتمد على البيئة فقط + مالك السيرفر (للدوال غير async) */
export function isBotOwnerOrGuildOwnerSync(
  guild: Guild | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  if (guild && String(guild.ownerId) === String(userId)) return true;
  return isEnvBotOwner(userId);
}