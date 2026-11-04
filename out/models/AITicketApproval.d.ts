import mongoose, { Document } from 'mongoose';
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
export declare const AITicketApproval: mongoose.Model<IAITicketApproval, {}, {}, {}, mongoose.Document<unknown, {}, IAITicketApproval, {}, {}> & IAITicketApproval & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default AITicketApproval;
//# sourceMappingURL=AITicketApproval.d.ts.map