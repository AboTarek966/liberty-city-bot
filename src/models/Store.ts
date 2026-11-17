// ============================================
// Omni Bot - Store Models (متجر البروجيكتات)
// نظام بيع بروجيكتات للجميع — الدفع بالكريديت عبر ProBot
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

// --------------------------------------------
// بروجيكت داخل المتجر
// --------------------------------------------
export interface IStoreProject {
  /** معرّف قصير فريد داخل المتجر (٦ أحرف) — يُستخدم في الأزرار */
  id: string;
  name: string;
  description?: string;
  /** السعر الصافي الأساسي (قبل خصم العرض، إن وجد) بالكريديت */
  price: number;
  /** نسبة خصم على هذا البروجيكت (0-99) — 0 أو غير محدد = بدون خصم */
  discountPercent?: number;
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

const StoreProjectSchema = new Schema<IStoreProject>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, min: 0, max: 99 },
    enabled: { type: Boolean, default: true },
    sales: { type: Number, default: 0, min: 0 },
    createdBy: { type: String },
  },
  { _id: false }
);

const StoreSchema = new Schema<IStore>(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
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
