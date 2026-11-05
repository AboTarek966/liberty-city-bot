// ============================================
// Omni Bot - Member Return Record
// سجل مغادرة/عودة العضو — لكشف تجاوز العقوبات:
// يخزّن حالة العضو قبل مغادرته (سجن/كتم/تحذيرات/رولات)
// وعند عودته تُعاد العقوبات النشطة ويُنبَّه الفريق.
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IJailSnapshot {
  roleId: string;
  channelId: string;
  reason?: string;
  expiresAt?: Date | null;
}

export interface IMemberReturnRecord extends Document {
  guildId: string;
  userId: string;
  username: string;
  displayName?: string;
  firstJoinAt?: Date;
  lastJoinAt?: Date;
  lastLeaveAt?: Date;
  /** عدد مرات المغادرة المسجّلة */
  leaveCount: number;
  /** عدد مرات العودة بعد مغادرة مسجّلة */
  rejoinCount: number;
  /** الرولات التي كان يحملها عند آخر مغادرة */
  lastRoles: string[];
  /** تحذيرات آخر 30 يوماً قبل المغادرة */
  warnings30d: number;
  /** إجراءات إشرافية آخر 14 يوماً قبل المغادرة */
  cases14d: number;
  /** آخر إجراء إشرافي (نص وصفي مختصر) */
  lastCaseLabel?: string;
  /** مغادرة مشبوهة: خلال 24 ساعة من عقوبة */
  evasionSuspicion: boolean;
  /** لقطة السجن النشط عند المغادرة — لإعادة تطبيقه */
  jailSnapshot?: IJailSnapshot | null;
  /** رول الكتم الذي كان عليه عند المغادرة — لإعادة تطبيقه */
  mutedRoleId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const JailSnapshotSchema = new Schema<IJailSnapshot>(
  {
    roleId: { type: String, required: true },
    channelId: { type: String, required: true },
    reason: { type: String },
    expiresAt: { type: Date, default: null },
  },
  { _id: false }
);

const MemberReturnRecordSchema = new Schema<IMemberReturnRecord>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: '' },
    displayName: { type: String, default: '' },
    firstJoinAt: { type: Date },
    lastJoinAt: { type: Date },
    lastLeaveAt: { type: Date },
    leaveCount: { type: Number, default: 0, min: 0 },
    rejoinCount: { type: Number, default: 0, min: 0 },
    lastRoles: [{ type: String }],
    warnings30d: { type: Number, default: 0, min: 0 },
    cases14d: { type: Number, default: 0, min: 0 },
    lastCaseLabel: { type: String },
    evasionSuspicion: { type: Boolean, default: false },
    jailSnapshot: { type: JailSnapshotSchema, default: null },
    mutedRoleId: { type: String, default: null },
  },
  { timestamps: true }
);

MemberReturnRecordSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const MemberReturnRecord = mongoose.model<IMemberReturnRecord>(
  'MemberReturnRecord',
  MemberReturnRecordSchema
);
export default MemberReturnRecord;
