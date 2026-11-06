// ============================================
// Omni Bot - AI JSON Output Helper
// ============================================
// النماذج أحياناً تُغلّف JSON داخل ```json أو تضيف كلاماً قبله.
// هذه الأداة تستخرج أول كائن JSON صالح من نص الرد.

export function extractJsonObject(raw: string): any | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    // محاولة إزالة الفواصل الزائدة قبل آخر قوس (خطأ شائع من النماذج)
    const cleaned = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

export function toStringArray(value: unknown, maxItems = 8, maxLength = 120): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => (item.length > maxLength ? item.slice(0, maxLength - 1) + '…' : item));
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}
