// ============================================
// Omni Bot - ذاكرة المستندات القصيرة
// تسمح بمتابعة الأسئلة عن مستند أُرسل مؤخراً في نفس القناة
// (افتراضياً: آخر 20 دقيقة) بدون إعادة إرفاقه.
// ============================================

const TTL_MS = 20 * 60 * 1000;
const MAX_ENTRIES = 300;
const MAX_TEXT_CHARS = 6000;

export interface RememberedDocument {
  name: string;
  text: string;
  ts: number;
}

const memory = new Map<string, RememberedDocument>();

export function rememberDocument(channelId: string, name: string, text: string): void {
  if (!channelId || !text || text.length < 40) return;

  memory.set(channelId, {
    name: name || 'مستند',
    text: text.slice(0, MAX_TEXT_CHARS),
    ts: Date.now(),
  });

  if (memory.size <= MAX_ENTRIES) return;

  // تنظيف المنتهي أولاً
  const now = Date.now();
  for (const [key, value] of memory) {
    if (now - value.ts > TTL_MS) memory.delete(key);
  }

  // لو لسا فوق الحد → نحذف الأقدم
  if (memory.size > MAX_ENTRIES) {
    const oldest = [...memory.entries()]
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(0, memory.size - MAX_ENTRIES);
    for (const [key] of oldest) memory.delete(key);
  }
}

export function getRememberedDocument(channelId: string): RememberedDocument | null {
  const hit = memory.get(channelId);
  if (!hit) return null;
  if (Date.now() - hit.ts > TTL_MS) {
    memory.delete(channelId);
    return null;
  }
  return hit;
}

export function forgetDocument(channelId: string): void {
  memory.delete(channelId);
}
