// ============================================
// رفع مباشر لصورة لوحة التذاكر
// الزر يطلب الرفع → أول رسالة مرفقة من نفس المستخدم تصبح صورة اللوحة
// ============================================

interface PendingUpload {
  guildId: string;
  channelId: string;
  userId: string;
  expiresAt: number;
}

const pending = new Map<string, PendingUpload>();

const TTL_MS = 60_000; // 60 ثانية لاختيار الصورة

export function setPendingImageUpload(userId: string, guildId: string, channelId: string): void {
  pending.set(userId, { guildId, channelId, userId, expiresAt: Date.now() + TTL_MS });
}

export function consumePendingImageUpload(userId: string): PendingUpload | null {
  const entry = pending.get(userId);
  if (!entry) return null;
  pending.delete(userId);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

export function hasPendingImageUpload(userId: string): boolean {
  const entry = pending.get(userId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    pending.delete(userId);
    return false;
  }
  return true;
}
