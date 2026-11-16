import { WheelOfFortuneOptions } from './wheelOfFortune';
export interface WheelRenderRequest {
    id: string;
    opts: WheelOfFortuneOptions;
}
interface WheelRenderOk {
    ok: true;
    id: string;
    buffer: Buffer;
}
interface WheelRenderErr {
    ok: false;
    id: string;
    error: string;
}
export type WheelRenderResponse = WheelRenderOk | WheelRenderErr;
export declare function canUseWheelWorker(): boolean;
/**
 * يحاول الرندر داخل خيوط عاملة لـ Node.
 * يرجع null لو الـ Worker غير متاح أو حدث خطأ/مهلة — المكالم الاحتياطي في الدفعة الأم.
 */
export declare function renderWheelInWorker(opts: WheelOfFortuneOptions, timeoutMs?: number): Promise<Buffer | null>;
export {};
//# sourceMappingURL=wheelWorker.d.ts.map