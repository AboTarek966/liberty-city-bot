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

// هل الهدف إداري؟ (مالك السيرفر أو لديه أي صلاحية إدارة)
// ⚠️ معرّف موحّد مع AIModeration — أي صلاحية إدارية تُعتبر "إداري"
const ADMIN_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageEmojisAndStickers,
  PermissionFlagsBits.ManageWebhooks,
];

export function isAdminTarget(target: GuildMember): boolean {
  if (target.id === target.guild.ownerId) return true;
  const perms = target.permissions;
  return ADMIN_PERMS.some(p => perms.has(p));
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
 * 🎭 مزامنة رولات التحذير (نظام تراكمي):
 * - 0 تحذيرات → بدون رول
 * - 1 → رول 1
 * - 2 → رول 1 + رول 2
 * - 3+ → رول 1 + رول 2 + رول 3
 * الأعضاء العاديون لا يحصلون على أي رول
 * يعيد ملاحظة بما تم، أو null لو ما فيش تغيير/إعداد
 */
async function cumulativeSync(opts: {
  guild: Guild;
  target: GuildMember;
  settings: any;
  reason: string;
  diag?: Record<string, any>;
}): Promise<{ note: string | null; count: number; wanted: number; configured: boolean }> {
  const { guild, target, settings, reason, diag } = opts;
  const set = (k: string, v: any) => { if (diag) diag[k] = v; };

  const seq = settings?.warnRoles?.adminSequential;
  if (!seq) {
    set('fail', 'no_sequential_config');
    return { note: null, count: 0, wanted: 0, configured: false };
  }

  const count = await getWarningCount(guild.id, target.id);
  set('warnCount', count);

  const configured = !!(seq.role1Id || seq.role2Id || seq.role3Id);
  const isAdmin = isAdminTarget(target);
  set('isAdmin', isAdmin);

  // 🔺 تراكمي: الرولات المطلوبة = كل المستويات ≤ عدد التحذيرات (بحد أقصى 3)
  const level = Math.min(count, 3);
  const wantedIds: string[] = [];
  if (isAdmin && level >= 1 && seq.role1Id) wantedIds.push(seq.role1Id);
  if (isAdmin && level >= 2 && seq.role2Id) wantedIds.push(seq.role2Id);
  if (isAdmin && level >= 3 && seq.role3Id) wantedIds.push(seq.role3Id);
  set('wantedIds', wantedIds);

  const allIds = [seq.role1Id, seq.role2Id, seq.role3Id].filter(Boolean) as string[];
  const wanted = new Set(wantedIds);
  const botTop = guild.members.me?.roles.highest.position ?? 0;
  const notes: string[] = [];

  // ① إزالة رولات التحذير الزائدة (غير المطلوبة)
  for (const id of allIds) {
    if (wanted.has(id) || !target.roles.cache.has(id)) continue;
    const role = guild.roles.cache.get(id);
    if (!role) continue;
    try {
      await target.roles.remove(role, `مزامنة رولات التحذير (${count} تحذير): ${reason}`);
      notes.push(`تم إزالة ${role.name}`);
    } catch (e: any) {
      set('fail', `remove_${id}: ${e.message}`);
      logger.warn(`sync remove role failed: ${e.message}`);
    }
  }

  // ② إعطاء الرولات الناقصة
  for (const id of wantedIds) {
    if (target.roles.cache.has(id)) continue;
    const role = guild.roles.cache.get(id);
    if (!role) { set(`missing_${id}`, 'not_in_cache'); continue; }
    if (role.managed) { set(`missing_${id}`, 'managed'); continue; }
    if (role.position >= botTop) { set(`missing_${id}`, `hierarchy(${role.position}>=${botTop})`); continue; }
    try {
      await target.roles.add(role, `تحذير إداري (${count} تحذير): ${reason}`);
      notes.push(`تم إعطاء ${role.name}`);
    } catch (e: any) {
      set(`missing_${id}`, e.message);
      logger.warn(`sync add role failed: ${e.message}`);
    }
  }

  return {
    note: notes.length ? notes.join('، ') : null,
    count,
    wanted: wantedIds.length,
    configured,
  };
}

/**
 * تطبيق رولات التحذير بعد التحذير (تراكمي):
 * - 1 تحذير → رول 1
 * - 2 تحذير → رول 1 + رول 2
 * - 3+ → رول 1 + رول 2 + رول 3
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
  /** حقل اختياري: يُملأ بسبب الفشل الدقيق */
  diag?: Record<string, any>;
}): Promise<string | null> {
  const { settings, guild, executor, target, reason, forceFreshSettings, diag } = opts;
  const set = (k: string, v: any) => { if (diag) diag[k] = v; };

  if (!isAdminTarget(target)) { set('fail', 'not_admin_target'); return null; }

  let effectiveSettings = settings;
  if (forceFreshSettings) {
    const { invalidateGuildSettings, getGuildSettings } = await import('../models');
    invalidateGuildSettings(guild.id);
    effectiveSettings = await getGuildSettings(guild.id);
  }

  try {
    const r = await cumulativeSync({
      guild, target, settings: effectiveSettings, reason, diag,
    });
    set('botTop', guild.members.me?.roles.highest.position ?? 0);

    if (!r.configured) { set('fail', 'no_roles_configured'); return null; }
    if (r.count === 0) { set('fail', 'count_zero'); return null; }
    if (!r.note) {
      // كل الرولات موجودة أصلاً
      return `🎭 العضو يملك بالفعل رولات التحذير (${r.count} تحذير)`;
    }
    logger.info(`Sequential admin warn roles (${r.count}) → ${target.id} (by ${executor.id}): ${r.note}`);
    return `🎭 ${r.note} (${r.count} تحذير)`;
  } catch (error: any) {
    set('fail', `exception: ${error.message}`);
    logger.warn(`applySequentialAdminWarnRoles failed: ${error.message}`);
    return null;
  }
}

/**
 * 🔄 مزامنة رولات التحذير بعد الإزالة (unwarn) — نظام تراكمي
 * يعيد ملاحظة بما تم، أو null لو ما فيش تغيير/إعداد
 */
export async function syncSequentialAdminWarnRoles(opts: {
  guild: Guild;
  target: GuildMember;
  settings: any;
}): Promise<string | null> {
  const { guild, target, settings } = opts;
  try {
    const r = await cumulativeSync({
      guild, target, settings, reason: 'مزامنة بعد إزالة تحذير',
    });
    return r.note;
  } catch (e: any) {
    logger.warn(`syncSequentialAdminWarnRoles failed: ${e.message}`);
    return null;
  }
}

/**
 * 🔢 إنزال التحذير لمستوى محدد (للإداريين): "شيل 2 @admin"
 * يحذف التحذيرات حتى يصبح عددها = level - 1، ثم يزامن رولات التحذير
 * - شيل 1 → 0 تحذيرات (مسح كامل)
 * - شيل 2 → تحذير واحد
 * - شيل 3 → تحذيران
 */
export async function removeWarnToLevel(opts: {
  guild: Guild;
  moderator: GuildMember;
  target: GuildMember;
  level: number;
  reason: string;
}): Promise<string> {
  const { guild, moderator, target, level, reason } = opts;

  const { Warning, ModerationCase, getNextCaseId, invalidateGuildSettings, getGuildSettings } =
    await import('../models');

  const current = await Warning.countDocuments({ guildId: guild.id, userId: target.id });
  if (current === 0) throw new Error('هذا العضو ليس لديه أي تحذيرات');

  const targetCount = Math.max(0, level - 1);
  if (targetCount >= current) {
    throw new Error(`العضو عنده ${current} تحذير فقط — لا يوجد ما يُزال عند المستوى ${level}`);
  }

  // نحذف أحدث التحذيرات حتى نبلغ المستوى المطلوب
  const toRemove = current - targetCount;
  const docs = await Warning.find({ guildId: guild.id, userId: target.id })
    .sort({ createdAt: -1 })
    .limit(toRemove)
    .select('_id');
  if (docs.length > 0) {
    await Warning.deleteMany({ _id: { $in: docs.map(d => d._id) } });
  }

  // سجل الحالة (في الخلفية — لا يؤخر الرد)
  void ModerationCase.create({
    guildId: guild.id,
    caseId: await getNextCaseId(guild.id),
    type: 'unwarn',
    moderatorId: moderator.id,
    targetId: target.id,
    reason: `${reason} (${current} ← ${targetCount})`,
    active: false,
  }).catch(err => logger.warn(`Case create failed: ${err.message}`));

  // 🔄 مزامنة رولات التحذير حسب العدد الجديد
  let roleNote: string | null = null;
  try {
    invalidateGuildSettings(guild.id);
    const settings = await getGuildSettings(guild.id);
    roleNote = await syncSequentialAdminWarnRoles({ guild, target, settings });
  } catch (e: any) {
    logger.warn(`sync after removeWarnToLevel failed: ${e.message}`);
  }

  logger.info(`Warn level lowered: ${target.id} ${current}→${targetCount} in ${guild.id} by ${moderator.id}`);
  return `✅ **${target.user.tag}** تحذيراته: ${current} ← ${targetCount}${roleNote ? ` | ${roleNote}` : ''} | ${reason}`;
}

/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - للإداريين فقط: نظام تسلسلي تلقائي (1→role1, 2→role2, 3→role3) أو pool adminIds
 * - للأعضاء العاديين: ❌ لا يُعطون أي رول (تحذير عدّاد فقط)
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

  // 🚫 الأعضاء العاديين لا يأخذون رول تحذير — تحذير عدّاد فقط
  if (!isAdminTarget(target)) return null;

  try {
    // أولاً: جرب النظام التسلسلي للإداريين (تلقائي، بدون لوحة)
    const sequentialNote = await applySequentialAdminWarnRoles({ settings, guild, executor, target, reason, forceFreshSettings: true });
    if (sequentialNote) return sequentialNote;

    // ثانياً: النظام القديم (pool من رولات التحذير الإدارية)
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
