// ============================================
// Liberty City Bot - تغييرات رولات التحذير المُعلّقة
// المستخدم يختار الرولات ← تُحفظ مؤقتاً هنا ← ثم يؤكد أو يلغي
// (بدون لمس قاعدة البيانات قبل التأكيد)
// ============================================

export interface PendingWarnRoles {
  /** رولات تحذير الأعضاء */
  members?: string[];
  /** رولات تحذير الإداريين (قائمة) */
  admins?: string[];
  /** النظام التسلسلي: [role1, role2, role3] */
  sequential?: string[];
  userId: string;
  at: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 دقيقة ثم تُنسى تلقائياً

const store = new Map<string, PendingWarnRoles>();

/** يجمع التغييرات الجديدة مع أي تغييرات مُعلّقة سابقاً بنفس السيرفر */
export function setPendingWarnRoles(
  guildId: string,
  patch: Partial<Pick<PendingWarnRoles, 'members' | 'admins' | 'sequential'>>,
  userId: string
): PendingWarnRoles {
  const prev = getPendingWarnRoles(guildId);
  const next: PendingWarnRoles = {
    ...(prev || {}),
    ...patch,
    userId,
    at: Date.now(),
  };
  store.set(guildId, next);
  return next;
}

export function getPendingWarnRoles(guildId: string): PendingWarnRoles | undefined {
  const p = store.get(guildId);
  if (!p) return undefined;
  if (Date.now() - p.at > TTL_MS) {
    store.delete(guildId);
    return undefined;
  }
  return p;
}

export function clearPendingWarnRoles(guildId: string): void {
  store.delete(guildId);
}

/** هل يوجد أي تغيير مُعلّق فعلاً؟ */
export function hasPendingWarnRoles(p: PendingWarnRoles | undefined): boolean {
  if (!p) return false;
  return !!(p.members || p.admins || p.sequential);
}

/** هل التغيير المُعلّق فارغ بالكامل (أي: مسح كل شيء)؟ — نعتبره تغييراً أيضاً */
export function pendingDiffers(
  p: PendingWarnRoles | undefined,
  current: { memberIds?: string[]; adminIds?: string[]; sequential?: string[] }
): boolean {
  if (!p) return false;
  const same = (a: string[] | undefined, b: string[] | undefined) =>
    JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
  if (p.members && !same(p.members, current.memberIds)) return true;
  if (p.admins && !same(p.admins, current.adminIds)) return true;
  if (p.sequential && !same(p.sequential, current.sequential)) return true;
  return false;
}
