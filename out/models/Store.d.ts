import mongoose, { Document } from 'mongoose';
export interface IStoreProject {
    /** معرّف قصير فريد داخل المتجر (٦ أحرف) — يُستخدم في الأزرار */
    id: string;
    name: string;
    description?: string;
    /** السعر الصافي (بعد خصم ProBot) بالكريديت */
    price: number;
    enabled: boolean;
    sales: number;
    createdBy?: string;
}
export interface IStore extends Document {
    key: string;
    /** المستلم لتحويلات ProBot (من يُعرض ذكره في أمر الدفع) */
    payeeId?: string;
    probotPrefix: string;
    /** نسبة خصم ProBot على التحويلات (افتراضي 5%) */
    taxPercent: number;
    /** قناة سجل الطلبات (اختياري — إن لم تُضبط تصل الطلبات للبائع بالخاص) */
    logChannelId?: string;
    /** الأعضاء المخوّلون بإدارة المتجر (يضيف/يعدّل/يستلم يدوياً) */
    managerIds: string[];
    projects: IStoreProject[];
}
export declare const Store: mongoose.Model<any, {}, {}, {}, any, any>;
export type StoreOrderStatus = 'pending' | 'paid' | 'cancelled';
export interface IStoreOrder extends Document {
    orderId: string;
    projectId: string;
    projectName: string;
    /** السعر الصافي المستهدف (بالكريديت) */
    price: number;
    /** المبلغ المطلوب تحويله فعلياً (المعروض لأمر الدفع) */
    amount: number;
    taxPercent: number;
    /** لقطة بمعرّف المستلم لحظة الطلب (حماية حتى لو تغيّرت الإعدادات لاحقاً) */
    payeeId?: string;
    probotPrefix?: string;
    buyerId: string;
    guildId?: string;
    status: StoreOrderStatus;
    paidBy?: string;
    paidAt?: Date;
}
export declare const StoreOrder: mongoose.Model<any, {}, {}, {}, any, any>;
//# sourceMappingURL=Store.d.ts.map