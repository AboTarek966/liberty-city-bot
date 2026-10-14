// ============================================
// Liberty City Bot - Interactive Game State (حالة الألعاب بأزرار)
// مخزن مؤقت للألعاب التي تحتاج نقرات: لغز / صناديق / قنبلة / بلك جاك
// ============================================

export type FunKind = 'riddle' | 'treasure' | 'bomb' | 'bj';

export interface FunState {
  kind: FunKind;
  data: Record<string, any>;
  expiresAt: number;
}

const store = new Map<string, FunState>();
const DEFAULT_TTL = 3 * 60 * 1000; // 3 دقائق لكل جولة

/** مُعرّف قصير عشوائي يدخل في customId */
export function newGameId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function setFunState(id: string, kind: FunKind, data: Record<string, any>, ttl = DEFAULT_TTL): void {
  cleanup();
  store.set(id, { kind, data, expiresAt: Date.now() + ttl });
}

/** يعيد الحالة أو null إذا انتهت (ويحذفها في نفس اللحظة) */
export function getFunState(id: string): FunState | null {
  const s = store.get(id);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    store.delete(id);
    return null;
  }
  return s;
}

export function delFunState(id: string): void {
  store.delete(id);
}

function cleanup(): void {
  const now = Date.now();
  for (const [id, s] of store) {
    if (now > s.expiresAt) store.delete(id);
  }
}
