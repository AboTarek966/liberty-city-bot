// ============================================
// Omni Bot - 🛡️ صلاحيات إدارة العشائر (مشتركة)
//    من يملكها:
//     • مالك البوت (application owner / OWNER_ID / DEVELOPER_USER_ID)
//     • مالك السيرفر
//     • أدمنستريتور + حامل أعلى رول في السيرفر
// ============================================

import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import { isBotOwner } from './botOwner';

/** هل المستخدم مخول لإدارة العشائر/المسابقات (نفس سياسة /clan)؟ */
export async function canManageClans(
  guild: Guild,
  userId: string,
  member?: GuildMember | null,
  client?: any
): Promise<boolean> {
  const guildMember =
    member instanceof GuildMember
      ? member
      : await guild.members.fetch(userId).catch(() => null);

  // مالك البوت
  try {
    if (client && (await isBotOwner(client, userId))) return true;
  } catch {
    const devId = process.env.DEVELOPER_USER_ID;
    const ownerId = process.env.OWNER_ID;
    if (ownerId && userId === ownerId) return true;
    if (devId && userId === devId) return true;
  }

  // مالك السيرفر
  if (guild.ownerId === userId) return true;

  const hasAdmin =
    guildMember?.permissions?.has?.(PermissionFlagsBits.Administrator) ?? false;

  // أعلى رول موجود في السيرفر (حسب ترتيب الرتب)
  const top = guild.roles?.highest;
  const hasHighestRole = !!guildMember && !!top && guildMember.roles.cache.has(top.id);

  return hasAdmin && hasHighestRole;
}

/** رد موحّد عند رفض الوصول لإدارة العشائر */
export function clanAccessDeniedMessage(): string {
  return (
    '⛔ **إدارة وفعاليات العشائر محصورة بـ:**\n' +
    '• من يملك صلاحية **أدمنستريتور** ومعه **أعلى رول** موجود في السيرفر\n' +
    '• أو مالك السيرفر\n' +
    '• أو مالك البوت\n\n' +
    '(القراءة متاحة للطاقم: `/clan list`، `/clan info`، `/clan leaderboard`، `/clan comp-status`)'
  );
}
