// ============================================
// Liberty City Bot - رولات التحذير
// عند التحذير: يُعطي رولاً واحداً مباشرة، أو يعرض لوحة اختيار
// (بنظام roleadd) تحتوي على رولات التحذير المُعدّة في الإعدادات فقط
// ============================================

import { Guild, GuildMember, PermissionFlagsBits, Role } from 'discord.js';
import { createRolePickerState, buildRolePicker } from './rolePicker';
import { createLogger } from './helpers';
import { Warning } from '../models';

const logger = createLogger('WarnRoles');

interface WarnRolesConfig {
  memberIds?: string[];
  adminIds?: string[];
  adminSequential?: {
    role1Id?: string;
    role2Id?: string;
    role3Id?: string;
  };
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
 * الحصول على عدد تحذيرات عضو في هذا السيرفر
 */
export async function getWarningCount(guildId: string, userId: string): Promise<number> {
  return await Warning.countDocuments({ guildId, userId });
}

/**
 * تطبيق نظام التحذيرات التسلسلي للإداريين:
 * - تحذير 1 → role1Id
 * - تحذير 2 → role2Id  
 * - تحذير 3 → role3Id
 * يعيد ملاحظة نصية بما تم، أو null لو ما فيش إعداد
 */
export async function applySequentialAdminWarnRoles(opts: {
  settings: any;
  guild: Guild;
  executor: GuildMember;
  target: GuildMember;
  reason: string;
  /** إذا true، يجيب إعدادات طازجة من قاعدة البيانات متجاهلاً الكاش */
  forceFreshSettings?: boolean;
}): Promise<string | null> {
  const { settings, guild, executor, target, reason, forceFreshSettings } = opts;

  // فقط للإداريين
  if (!isAdminTarget(target)) return null;

  // إذا طُلب بيانات طازجة، أبطل الكاش وجيب إعدادات جديدة
  let effectiveSettings = settings;
  if (forceFreshSettings) {
    const { invalidateGuildSettings, getGuildSettings } = await import('../models');
    invalidateGuildSettings(guild.id);
    effectiveSettings = await getGuildSettings(guild.id);
  }

  const sequential = effectiveSettings?.warnRoles?.adminSequential;
  if (!sequential) return null;

  // حساب عدد التحذيرات الحالي (بما فيها التحذير الجديد)
  const currentCount = await getWarningCount(guild.id, target.id);

  // تحديد الرول المناسب
  let roleId: string | undefined;
  let roleNumber: number;

  if (currentCount === 1) {
    roleId = sequential.role1Id;
    roleNumber = 1;
  } else if (currentCount === 2) {
    roleId = sequential.role2Id;
    roleNumber = 2;
  } else if (currentCount >= 3) {
    roleId = sequential.role3Id;
    roleNumber = 3;
  } else {
    return null; // لا يوجد رول لهذا العدد
  }

  if (!roleId) return null;

  try {
    const botTop = guild.members.me?.roles.highest.position ?? 0;
    const role = guild.roles.cache.get(roleId);

    if (!role || role.id === guild.id || role.managed || role.position >= botTop) {
      logger.warn(`Sequential warn role ${roleId} not usable (hierarchy/managed)`);
      return null;
    }

    // إذا كان العضو يملك الرول بالفعل، لا نعيد إعطاؤه
    if (target.roles.cache.has(roleId)) {
      return `🎭 العضو يملك بالفعل رول التحذير رقم ${roleNumber}: <@&${roleId}>`;
    }

    await target.roles.add(role, `تحذير إداري تسلسلي #${currentCount}: ${reason}`);
    logger.info(`Sequential admin warn role applied: ${role.name} (warning #${currentCount}) → ${target.id} (by ${executor.id})`);
    return `🎭 تم إعطاء رول التحذير رقم ${roleNumber}: <@&${roleId}>`;
  } catch (error: any) {
    logger.warn(`applySequentialAdminWarnRoles failed: ${error.message}`);
    return null;
  }
}

/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - للإداريين: نظام تسلسلي تلقائي (1→role1, 2→role2, 3→role3)
 * - للأعضاء: رول واحد فقط → يُعطى مباشرة، أو لوحة اختيار
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
    // أولاً: جرب النظام التسلسلي للإداريين (تلقائي، بدون لوحة)
    const sequentialNote = await applySequentialAdminWarnRoles({ settings, guild, executor, target, reason, forceFreshSettings: true });
    if (sequentialNote) return sequentialNote;

    // ثانياً: النظام القديم (pool من رولات التحذير)
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
