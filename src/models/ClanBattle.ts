// ============================================
// Omni Bot - 🛡️ نموذج مسابقات العشائر
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IClanBattle extends Document {
  guildId: string;
  /** اسم "المعركة" (اختياري) — ينصح بكتابته حتى لا تتداخل المسابقات */
  name: string;
  /** معرفات العشائر المتنافسة */
  clanIds: string[];
  /** المدة بالأيام */
  durationDays: number;
  /** تاريخ البدء */
  startsAt: Date;
  /** تاريخ الانتهاء */
  endsAt: Date;
  /** قناة إعلان الفائز */
  channelId?: string;
  /** حالة المسابقة */
  status: 'active' | 'ended' | 'cancelled';
  /** معرف العشيرة الفائزة — يُملأ بعد انتهاء المسابقة */
  winnerClanId?: string;
  /** معرف الأعضاء المعلنين (الفائزين) */
  winnerMemberIds?: string[];
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClanBattleSchema = new Schema<IClanBattle>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, default: 'مسابقة عشائرية', maxlength: 64 },
    clanIds: [{ type: String, required: true }],
    durationDays: { type: Number, default: 7, min: 1, max: 30 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    channelId: { type: String },
    status: { type: String, enum: ['active', 'ended', 'cancelled'], default: 'active', index: true },
    winnerClanId: { type: String },
    winnerMemberIds: [{ type: String }],
    endedAt: { type: Date },
  },
  { timestamps: true }
);

ClanBattleSchema.index({ guildId: 1, status: 1, endsAt: 1 });

export const ClanBattle = mongoose.model<IClanBattle>('ClanBattle', ClanBattleSchema);
export default ClanBattle;
