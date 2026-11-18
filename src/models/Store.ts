// ============================================
// Omni Bot - Store Models (متجر Omni)
// نظام بيع (بروجيكتات / بوتات / أدوات / رتب / خدمات / أخرى)
// الدفع بالكريديت عبر ProBot
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

// --------------------------------------------
// أنواع العناصر المتاحة في المتجر
// --------------------------------------------
export type StoreItemType = 'project' | 'bot' | 'tool' | 'role' | 'service' | 'other';

export const STORE_ITEM_TYPE_VALUES: StoreItemType[] = [
  'project',
  'bot',
  'tool',
  'role',
  'service',
  'other',
];

// --------------------------------------------
// عنصر داخل المتجر (بروجيكت / بوت / أداة / رتبة / خدمة / أخرى)
// --------------------------------------------
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

const StoreProjectSchema = new Schema<IStoreProject>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: STORE_ITEM_TYPE_VALUES,
      default: 'project',
    },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, min: 0, max: 99 },
    /** الرول اللي يتمنح تلقائياً للمشتري عند تأكيد استلام الدفع/التسليم */
    deliveryRoleId: { type: String },
    emoji: { type: String },
    imageUrl: { type: String },
    /** غير محدد = كميات غير محدودة */
    stock: { type: Number, min: 0 },
    deliveryNote: { type: String },
    enabled: { type: Boolean, default: true },
    sales: { type: Number, default: 0, min: 0 },
    createdBy: { type: String },
  },
  { _id: false }
);

const StoreSchema = new Schema<IStore>(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    payeeId: { type: String },
    probotPrefix: { type: String, default: '!' },
    taxPercent: { type: Number, default: 5, min: 0, max: 25 },
    logChannelId: { type: String },
    managerIds: { type: [String], default: [] },
    projects: { type: [StoreProjectSchema], default: [] },
  },
  { timestamps: true }
);

export const Store =
  mongoose.models.Store || mongoose.model<IStore>('Store', StoreSchema);

// --------------------------------------------
// طلب شراء (من الموافقة حتى التسليم)
// --------------------------------------------
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

const StoreOrderSchema = new Schema<IStoreOrder>(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    projectName: { type: String, required: true },
    itemType: { type: String, enum: STORE_ITEM_TYPE_VALUES },
    itemEmoji: { type: String },
    itemDeliveryNote: { type: String },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 5, min: 0, max: 25 },
    payeeId: { type: String },
    probotPrefix: { type: String },
    buyerId: { type: String, required: true, index: true },
    guildId: { type: String },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending', index: true },
    paidBy: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

export const StoreOrder =
  mongoose.models.StoreOrder || mongoose.model<IStoreOrder>('StoreOrder', StoreOrderSchema);
