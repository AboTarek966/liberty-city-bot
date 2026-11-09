export type FunKind = 'riddle' | 'treasure' | 'bomb' | 'bj';
export interface FunState {
    kind: FunKind;
    data: Record<string, any>;
    expiresAt: number;
}
/** مُعرّف قصير عشوائي يدخل في customId */
export declare function newGameId(): string;
export declare function setFunState(id: string, kind: FunKind, data: Record<string, any>, ttl?: number): void;
/** يعيد الحالة أو null إذا انتهت (ويحذفها في نفس اللحظة) */
export declare function getFunState(id: string): FunState | null;
export declare function delFunState(id: string): void;
//# sourceMappingURL=funGameState.d.ts.map