// ============================================
// Liberty City Bot - Giveaway Model
// ============================================
// سحب محفوظ في قاعدة البيانات — يبقى شغّالاً بعد إعادة تشغيل البوت

import mongoose, { Document, Schema } from 'mongoose';

export interface IGiveawayRequirements {
  /** رول مطلوب للمشاركة (فارغ = لا يوجد شرط) */
  roleIds: string[];
  /** أقل مستوى مطلوب في نظام المستويات */
  minLevel: number;
  /** أقل عمر للحساب بالأيام */
  minAccountAgeDays: number;
  /** أقل عدد دعوات (تقريبي من دعوات السيرفر الحالية) */
  minInvites: number;
}

export interface IGiveaway extends Document {
  guildId: string;
  /** معرّف قصير يظهر للمستخدم — مثال: A1B2C3 */
  shortId: string;
  channelId: string;
  messageId?: string;
  hostId: string;
  prize: string;
  description?: string;
  winnersCount: number;
  endsAt: Date;
  ended: boolean;
  endedAt?: Date;
  winnerIds: string[];
  entries: string[];
  requirements: IGiveawayRequirements;
  createdAt: Date;
  updatedAt: Date;
}

const GiveawayRequirementsSchema = new Schema<IGiveawayRequirements>({
  roleIds: [{ type: String }],
  minLevel: { type: Number, default: 0, min: 0 },
  minAccountAgeDays: { type: Number, default: 0, min: 0 },
  minInvites: { type: Number, default: 0, min: 0 },
}, { _id: false });

const GiveawaySchema = new Schema<IGiveaway>({
  guildId: { type: String, required: true, index: true },
  shortId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String },
  hostId: { type: String, required: true },
  prize: { type: String, required: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 1000 },
  winnersCount: { type: Number, default: 1, min: 1, max: 20 },
  endsAt: { type: Date, required: true },
  ended: { type: Boolean, default: false },
  endedAt: { type: Date },
  winnerIds: [{ type: String }],
  entries: [{ type: String }],
  requirements: { type: GiveawayRequirementsSchema, default: () => ({}) },
}, { timestamps: true });

GiveawaySchema.index({ guildId: 1, shortId: 1 }, { unique: true });
GiveawaySchema.index({ ended: 1, endsAt: 1 });

export const Giveaway = mongoose.model<IGiveaway>('Giveaway', GiveawaySchema);
export default Giveaway;
