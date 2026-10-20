// ============================================
// Liberty City Bot - Translate Store
// ============================================
// تخزين مؤقت لسياق الترجمة حتى تستطيع أزرار
// (نسخ/إعادة/تغيير اللغة) الوصول للنص الأصلي
// بعد إعادة تشغيل البوت يُنسى تلقائياً (مقبول)

const store = new Map<string, { text: string; sourceLang: string; targetLang: string; translatedText: string; at: number }>();

const TTL = 30 * 60 * 1000; // 30 دقيقة
const MAX = 500;

export function putTranslation(
  messageId: string,
  data: { text: string; sourceLang: string; targetLang: string; translatedText: string }
): void {
  // تنظيف المنتهية الصلاحية عند كل إضافة
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.at > TTL) store.delete(k);
  }
  if (store.size >= MAX) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(messageId, { ...data, at: now });
}

export function getTranslation(messageId: string): { text: string; sourceLang: string; targetLang: string; translatedText: string } | null {
  const item = store.get(messageId);
  if (!item) return null;
  if (Date.now() - item.at > TTL) {
    store.delete(messageId);
    return null;
  }
  return item;
}
