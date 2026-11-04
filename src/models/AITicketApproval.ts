// ============================================
// Omni Bot - AI Ticket Approval Model
// ============================================
// طلبات موافقة الإدارة على إجراءات مساعد التذاكر — محفوظة في قاعدة
// البيانات حتى لا تضيع عند إعادة تشغيل البوت.

import mongoose, { Document, Schema } from 'mongoose';

export interface IAITicketApproval extends Document {
  approvalId: string;
  guildId: string;
  ticketId: string;
  /** صاحب التذكرة — الهدف الافتراضي لأي إجراء عليه */
  ticketUserId?: string;
  channelId: string;
  /** الإجراء المطلوب (RequiredAction) — Mixed لأن شكله يعتمد على نوع الإجراء */
  action: Record<string, any>;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  /** نتيجة التنفيذ بعد الموافقة (للتدقيق) */
  resultMessage?: string;
  requestedAt: Date;
  expiresAt: Date;
}

const AITicketApprovalSchema = new Schema<IAITicketApproval>({
  approvalId: { type: String, required: true, unique: true, index: true },
  guildId: { type: String, required: true, index: true },
  ticketId: { type: String, required: true },
  ticketUserId: { type: String },
  channelId: { type: String, required: true },
  action: { type: Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'expired'],
    default: 'pending',
    index: true,
  },
  requestedBy: { type: String, default: 'ai' },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  resultMessage: { type: String },
  requestedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

AITicketApprovalSchema.index({ guildId: 1, status: 1, expiresAt: 1 });

export const AITicketApproval = mongoose.model<IAITicketApproval>(
  'AITicketApproval',
  AITicketApprovalSchema
);
export default AITicketApproval;
