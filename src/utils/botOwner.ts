// ============================================
// Liberty City Bot - 👑 تحقق من ملكية البوت
// يحدد المالك تلقائياً من بيئة العمل أو من مالك التطبيق في Discord
// ============================================

import type { Client, User, Team } from 'discord.js';

let cachedOwnerIds: string[] | null = null;

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