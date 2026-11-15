// ============================================
// Omni Bot - 👑 رتب الإدارة (Shared) — تُستخدم من /createstaffroles ومرة واحدة عند الإقلاع
// آمنة للتكرار: يتحقق من الترتيب المطلوب، وإن لم يكن → يعيد ترتيبه من الأعلى للنزول
// ============================================

import { Guild, PermissionFlagsBits, RoleCreateOptions, SetRolePositionOptions } from 'discord.js';
import { createLogger } from './helpers';

const logger = createLogger('StaffRoles');

export interface StaffRoleDef {
  name: string;
  color: number;
  perms: bigint[];
  hoist: boolean;
  mentionable: boolean;
  tier: 'high' | 'middle' | 'junior' | 'separator';
}

const HIGH_PERMS = [
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.KickMembers,
];
const MIDDLE_PERMS = [
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
];
const JUNIOR_PERMS = [PermissionFlagsBits.ModerateMembers];
const SEPARATOR_PERMS: bigint[] = [];

// الأسماء الجديدة (فصحى عربية) + الأسماء القديمة (الإنجليزية المشطرة) للهجرة ضدها
export const LEGACY_STAFF_ROLE_NAMES = [
  '『👑』・𝐎𝐰𝐧𝐞𝐫',
  '『💎』・𝐂𝐨-𝐎𝐰𝐧𝐞𝐫',
  '『⚜️』・𝐅𝐨𝐮𝐧𝐝𝐞𝐫',
  '『⚡』・𝐇𝐢𝐠𝐡 𝐌𝐚𝐧𝐚𝐠𝐞𝐦𝐞𝐧𝐭',
  '『💼』・𝐄𝐱𝐞𝐜𝐮𝐭𝐢𝐯𝐞 𝐃𝐢𝐫𝐞𝐜𝐭𝐨𝐫',
  '══════ 👑 𝐇𝐢𝐠𝐡 𝐒𝐭𝐚𝐟𝐟 👑 ══════',
  '『🔥』・𝐇𝐞𝐚𝐝 𝐀𝐝𝐦𝐢𝐧',
  '『🔱』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐀𝐝𝐦𝐢𝐧',
  '『🛡️』・𝐀𝐝𝐦𝐢𝐧',
  '『⚙️』・𝐒𝐮𝐩𝐞𝐫𝐯𝐢𝐬𝐨𝐫',
  '『⚔️』・𝐇𝐞𝐚𝐝 𝐌𝐨𝐝',
  '══════ 🛡️ 𝐌𝐢𝐝𝐝𝐥𝐞 𝐒𝐭𝐚𝐟𝐟 🛡️ ══════',
  '『🔰』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐌𝐨𝐝',
  '『🔨』・𝐌𝐨𝐝𝐞𝐫𝐚𝐭𝐨𝐫',
  '『🎧』・𝐒𝐮𝐩𝐩𝐨𝐫𝐭 𝐓𝐞𝐚𝐦',
  '『🌟』・𝐇𝐞𝐥𝐩𝐞𝐫',
  '『📝』・𝐓𝐫𝐢𝐚𝐥 𝐒𝐭𝐚𝐟𝐟',
  '══════ 🔰 𝐉𝐮𝐧𝐢𝐨𝐫 𝐒𝐭𝐚𝐟𝐟 🔰 ══════',
] as const;

export const STAFF_ROLES = [
  // ===== 👑 الإدارة العليا =====
  { name: '『👑』・المالك',                  color: 0xf1c40f, perms: HIGH_PERMS,   hoist: true,  mentionable: true,  tier: 'high' as const },
  { name: '『💎』・نائب المالك',             color: 0xe67e22, perms: HIGH_PERMS,   hoist: true,  mentionable: true,  tier: 'high' as const },
  { name: '『⚜️』・المؤسس',                   color: 0x9b59b6, perms: HIGH_PERMS,   hoist: true,  mentionable: true,  tier: 'high' as const },
  { name: '『⚡』・الإدارة العليا',           color: 0xe74c3c, perms: HIGH_PERMS,   hoist: true,  mentionable: true,  tier: 'high' as const },
  { name: '『💼』・المدير التنفيذي',          color: 0xe91e63, perms: HIGH_PERMS,   hoist: true,  mentionable: true,  tier: 'high' as const },
  { name: '══════ 👑 الإدارة العليا ══════', color: 0x2f3136, perms: SEPARATOR_PERMS, hoist: false, mentionable: false, tier: 'separator' as const },

  // ===== 🛡️ الإدارة الوسطى =====
  { name: '『🔥』・رئيس الإداريين',         color: 0xe74c3c, perms: MIDDLE_PERMS, hoist: true,  mentionable: true,  tier: 'middle' as const },
  { name: '『🔱』・إداري خبير',              color: 0xf39c12, perms: MIDDLE_PERMS, hoist: true,  mentionable: true,  tier: 'middle' as const },
  { name: '『🛡️』・إداري عام',               color: 0x95a5a6, perms: MIDDLE_PERMS, hoist: true,  mentionable: true,  tier: 'middle' as const },
  { name: '『⚙️』・مشرف عام',                color: 0x2ecc71, perms: MIDDLE_PERMS, hoist: true,  mentionable: true,  tier: 'middle' as const },
  { name: '『⚔️』・رئيس المراقبين',          color: 0x34495e, perms: MIDDLE_PERMS, hoist: true,  mentionable: true,  tier: 'middle' as const },
  { name: '══════ 🛡️ الإدارة الوسطى ══════', color: 0x2f3136, perms: SEPARATOR_PERMS, hoist: false, mentionable: false, tier: 'separator' as const },

  // ===== 🔰 الإدارة الصغرى =====
  { name: '『🔰』・مراقب أول',               color: 0x1abc9c, perms: JUNIOR_PERMS, hoist: true,  mentionable: true,  tier: 'junior' as const },
  { name: '『🔨』・مراقب',                    color: 0x27ae60, perms: JUNIOR_PERMS, hoist: true,  mentionable: true,  tier: 'junior' as const },
  { name: '『🎧』・فريق الدعم',              color: 0x3498db, perms: JUNIOR_PERMS, hoist: true,  mentionable: true,  tier: 'junior' as const },
  { name: '『🌟』・مساعد',                   color: 0xf7dc6f, perms: JUNIOR_PERMS, hoist: true,  mentionable: true,  tier: 'junior' as const },
  { name: '『📝』・إداري تحت التجربة',        color: 0x7f8c8d, perms: JUNIOR_PERMS, hoist: true,  mentionable: true,  tier: 'junior' as const },
  { name: '══════ 🔰 الإدارة الصغرى ══════', color: 0x2f3136, perms: SEPARATOR_PERMS, hoist: false, mentionable: false, tier: 'separator' as const },
] as const;

export interface StaffRolesResult {
  /** true = الرتب الـ18 موجودة والترتيب صحيح بالفعل */
  skipped: boolean;
  created: string[];
  reused: string[];
  failed: string[];
  botHighestName: string;
  botHighestPosition: number;
  finalOrder: Array<{ position: number; roleId: string; name: string }>;
}

function orderedCacheEntries(guild: Guild) {
  const entries: any[] = [];
  for (const [i, def] of STAFF_ROLES.entries()) {
    const legacy = LEGACY_STAFF_ROLE_NAMES[i];
    let role = guild.roles.cache.find((r) => r.name === def.name);
    if (!role) role = guild.roles.cache.find((r) => r.name === legacy);
    if (role) entries.push(role);
  }
  return entries;
}

function findDefRole(guild: Guild, index: number) {
  const def = STAFF_ROLES[index];
  const legacy = LEGACY_STAFF_ROLE_NAMES[index];
  return guild.roles.cache.find((r) => r.name === def.name) || guild.roles.cache.find((r) => r.name === legacy);
}

function isAlreadyCorrect(guild: Guild): boolean {
  const cached = orderedCacheEntries(guild);
  const me = guild.members.me;
  const myHighest = me?.roles?.highest?.position ?? 1;
  if (cached.length !== STAFF_ROLES.length) return false;

  // كل رتب إدارتنا بلاثة أقفال:
  // 1) أعلى رتبة جديدة (OWNER العربية) لازم تكون تحت رتبة البوت العليا مباشرة (myHighest-1)
  const owner = findDefRole(guild, 0) as any;
  if (!owner || owner.position !== Math.max(1, myHighest - 1)) return false;

  // 2) بلا تساوٍ ولا عكس ترتيب بالأسفل
  for (let i = 0; i < cached.length - 1; i++) {
    if ((cached[i] as any).position <= (cached[i + 1] as any).position) return false;
  }
  return true;
}

export async function ensureStaffRoles(guild: Guild): Promise<StaffRolesResult> {
  const me = guild.members.me;
  const myHighest = me?.roles?.highest?.position ?? 1;
  const botHighestName = me?.roles?.highest?.name ?? '—';

  // 🧊 كل الرتب موجودة والترتيب صح → لا تتغير ولا تنسخة في الإقلاع
  if (isAlreadyCorrect(guild)) {
    const finalOrder = orderedCacheEntries(guild)
      .sort((a: any, b: any) => b.position - a.position)
      .map((r: any) => ({ position: r.position, roleId: r.id, name: r.name }));
    return { skipped: true, created: [], reused: [], failed: [], botHighestName, botHighestPosition: myHighest, finalOrder };
  }

  const created: string[] = [];
  const failed: string[] = [];
  const reused: string[] = [];

  // 1) تأكد من إنشاء كل رتبة غير موجودة + لونها/صلاحياتها محدثة
  for (const [gridIndex, def] of STAFF_ROLES.entries()) {
    let role = guild.roles.cache.find((r) => r.name === def.name);
    try {
      if (role) {
        // الرتب موجودة باسمها الجديد — حدّثها فقط
        await role.edit({
          color: def.color,
          permissions: def.perms,
          hoist: def.hoist,
          mentionable: def.mentionable,
          reason: 'Omni — مزامنة رتب الإدارة',
        } as any);
        reused.push(def.name);
      } else {
        // جرّب إيجاد الرتبة باسمها القديم → أعد تسميتها
        const legacy = guild.roles.cache.find((r) => r.name === LEGACY_STAFF_ROLE_NAMES[gridIndex]);
        if (legacy) {
          role = await legacy.edit({
            name: def.name,
            color: def.color,
            permissions: def.perms,
            hoist: def.hoist,
            mentionable: def.mentionable,
            reason: 'Omni — تعريب رتب الإدارة',
          } as any);
          reused.push(`↺ ${def.name}`);
        } else {
          const options: RoleCreateOptions = {
            name: def.name,
            color: def.color,
            permissions: def.perms,
            hoist: def.hoist,
            mentionable: def.mentionable,
            reason: 'Omni — إنشاء رتب الإدارة',
          };
          role = await guild.roles.create(options);
          created.push(def.name);
        }
      }
    } catch (error: any) {
      failed.push(`${def.name} — ${error?.message || 'خطأ غير معروف'}`);
      logger.warn(`ensureStaffRoles failed "${def.name}": ${error?.message}`);
    }
  }

  // 2) أعد التوزيع من الأعلى للأسفل بمواضع مثبتة
  try {
    const cached = orderedCacheEntries(guild);
    const topPosition = Math.max(1, myHighest - 1);
    let pos = topPosition;
    const orderedForPlacement = STAFF_ROLES.map((def) => guild.roles.cache.find((r) => r.name === def.name)).filter(Boolean) as any[];
    for (const role of orderedForPlacement) {
      const targetPos = pos--;
      if (role.position !== targetPos) {
        try {
          await role.setPosition(targetPos, { reason: 'Omni — استعادة رتب الإدارة (إعادة الترتيب)' } as SetRolePositionOptions);
        } catch (error: any) {
          failed.push(`${role.name} — تثبيت موقع ${targetPos}: ${error?.message || 'خطأ'}`);
          logger.warn(`setPosition "${role.name}" -> ${targetPos}: ${error?.message}`);
        }
      }
    }
    // تحديث الكاش للترتيب النهائي
    await guild.roles.fetch().catch(() => null);
    logger.info('🔧 رتب الإدارة: الترتيب أُصلح من الأعلى للأسفل');
  } catch (error: any) {
    failed.push(`إعادة الترتيب: ${error?.message || 'خطأ'}`);
    logger.warn(`reposition failed: ${error?.message}`);
  }

  const finalOrder = orderedCacheEntries(guild)
    .sort((a: any, b: any) => b.position - a.position)
    .map((r: any) => ({ position: r.position, roleId: r.id, name: r.name }));

  return { skipped: false, created, reused, failed, botHighestName, botHighestPosition: myHighest, finalOrder };
}
