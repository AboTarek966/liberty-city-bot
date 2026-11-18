import mongoose, { Document } from 'mongoose';
export type StoreItemType = 'project' | 'bot' | 'tool' | 'role' | 'service' | 'other';
export declare const STORE_ITEM_TYPE_VALUES: StoreItemType[];
export interface IStoreProject {
    /** معرّف قصير فريد داخل المتجر (٦ أحرف) — يُستخدم في الأزرار */
    id: string;
    name: string;
    /** نوع العنصر — الافتراضي project للعناصر القديمة */
    type?: StoreItemType;
    description?: string;
    /** السعر الصافي الأساسي (قبل خصم العرض، إن وجد) بالكريديت */
    price: number;
    /** نسبة خصم على هذا العنصر (0-99) — 0 أو غير محدد = بدون خصم */
    discountPercent?: number;
    /** الرول اللي يتمنح للمشتري تلقائياً عند تأكيد البائع استلام الدفع/التسليم (اختياري) */
    deliveryRoleId?: string;
    /** إيموجي مخصص للعنصر (unicode أو <:name:id>) — يظهر في القائمة */
    emoji?: string;
    /** صورة/بانر للعنصر (رابط http/https) */
    imageUrl?: string;
    /** الكمية المتاحة — غير محدد = غير محدود • 0 = نفدت الكمية */
    stock?: number;
    /** ملاحظات التسليم — تظهر للمشتري في إيصال التسليم (مثال: البوت يوصلك في الخاص) */
    deliveryNote?: string;
    enabled: boolean;
    sales: number;
    createdBy?: string;
}
export interface IStore extends Document {
    key: string;
    /** اسم المتجر المعروض (افتراضي: متجر Omni) */
    name?: string;
    /** وصف/تعريف المتجر يظهر أعلى لوحة الشراء */
    description?: string;
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
    /** لقطة نوع العنصر وقت الطلب */
    itemType?: StoreItemType;
    /** لقطة إيموجي العنصر وقت الطلب */
    itemEmoji?: string;
    /** لقطة ملاحظة التسليم وقت الطلب */
    itemDeliveryNote?: string;
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