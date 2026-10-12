// ============================================
// Liberty City Bot - رولات التحذير
// عند التحذير: يُعطي رولاً واحداً مباشرة، أو يعرض لوحة اختيار
// (بنظام roleadd) تحتوي على رولات التحذير المُعدّة في الإعدادات فقط
// ============================================

import { Guild, GuildMember, PermissionFlagsBits, Role } from 'discord.js';
import { createRolePickerState, buildRolePicker } from './rolePicker';
import { createLogger } from './helpers';

const logger = createLogger('WarnRoles');

interface WarnRolesConfig {
  memberIds?: string[];
  adminIds?: string[];
}

// هل الهدف إداري؟ (مالك السيرفر أو لديه صلاحية أدمن/إدارة)
export function isAdminTarget(target: GuildMember): boolean {
  if (target.id === target.guild.ownerId) return true;
  const perms = target.permissions;
  return (
    perms.has(PermissionFlagsBits.Administrator) ||
    perms.has(PermissionFlagsBits.ManageGuild)
  );
}

// قائمة رولات التحذير المناسبة لنوع الهدف (إداري ⇐ adminIds، عضو ⇐ memberIds)
export function getWarnRolePool(settings: any, target: GuildMember): string[] {
  const w: WarnRolesConfig = settings?.warnRoles || {};
  return [...(isAdminTarget(target) ? w.adminIds || [] : w.memberIds || [])];
}

/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - رول واحد فقط → يُعطى مباشرة ويُرجع ملاحظة
 * - أكثر من رول → يعرض لوحة اختيار (من رولات التحذير فقط)
 * - لا توجد رولات قابلة → يُرجع null
 */
export async function offerWarnRoles(opts: {
  settings: any;
  guild: Guild;
  executor: GuildMember;
  target: GuildMember;
  reason: string;
  reply: (payload: { content: string; components: any[] }) => Promise<unknown>;
}): Promise<string | null> {
  const { settings, guild, executor, target, reason, reply } = opts;

  try {
    const pool = getWarnRolePool(settings, target);
    if (pool.length === 0) return null;

    const botTop = guild.members.me?.roles.highest.position ?? 0;
    const usable: Role[] = pool
      .map(id => guild.roles.cache.get(id))
      .filter(
        (r): r is Role =>
          !!r &&
          r.id !== guild.id &&
          !r.managed &&
          r.position < botTop &&
          !target.roles.cache.has(r.id)
      );

    if (usable.length === 0) return null;

    // رول واحد فقط → إعطاء مباشر بدون لوحة
    if (usable.length === 1) {
      const role = usable[0];
      await target.roles.add(role, `رول تحذير: ${reason}`);
      logger.info(`Warn role applied: ${role.name} → ${target.id} (by ${executor.id})`);
      return `🎭 تم إعطاء رول التحذير: <@&${role.id}>`;
    }

    // أكثر من رول → لوحة اختيار (نظام roleadd) بقائمة رولات التحذير فقط
    const state = createRolePickerState(
      executor.id,
      target.id,
      reason,
      usable.map(r => r.id),
      `⚠️ اختر رول التحذير الذي تريد إعطاؤه لـ <@${target.id}>\n(القائمة تحتوي على رولات التحذير فقط)`
    );
    const { content, components } = buildRolePicker(state, guild, executor);
    await reply({ content, components });
    return '🎭 اختر رول التحذير من القائمة بالأسفل';
  } catch (error: any) {
    logger.warn(`offerWarnRoles failed: ${error.message}`);
    return null;
  }
}
