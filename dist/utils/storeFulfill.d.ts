import { Client, Guild } from 'discord.js';
export interface FulfillSummary {
    /** هل نجح الاستيلاء على الطلب قبل أي منافس آخر؟ */
    claimed: boolean;
    /** لقطة الحالة قبل التنفيذ */
    alreadyDone?: boolean;
    totalSales?: number;
    stockLine?: string | null;
    roleLine?: string | null;
    projectIncluded?: boolean;
    filesRequested?: boolean;
}
interface FulfillInput {
    /** 'auto' = ورد من وكيل الاكتشاف التلقائي • 'manual' = زر البائع */
    mode: 'auto' | 'manual';
    /** معرّف الطلب (للهجوم الذري). لا يلزم أن يكون وثيقة كاملة. */
    orderId: string;
    /** سيرفر الدفع/النشر — يُستخدم لمنح رول التسليم */
    guild?: Guild | null;
    /** معرّف من أكّد (للتوثيق) — تُسجَّل "auto" للاكتشاف التلقائي */
    actorLabel?: string;
    /** هل نرسل بطاقة إشعار بذلك لقناة السجل/البائع؟ (الاكتشاف التلقائي: نعم) */
    notifyLog?: boolean;
}
/**
 * يمسك الطلب ذرياً (status: pending → paid) ثم ينفّذ التسليم:
 *   زيادة مبيعات العنصر + خصم الكمية + منح رول التسليم + إيصال خاص للمشتري.
 * @returns تفاصيل ما تم (أو claimed=false لو سبق إنهاء الطلب)
 */
export declare function fulfillStoreOrder(client: Client | null, input: FulfillInput): Promise<FulfillSummary>;
export {};
//# sourceMappingURL=storeFulfill.d.ts.map