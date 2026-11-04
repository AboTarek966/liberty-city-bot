import mongoose, { Document } from 'mongoose';
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
export declare const Giveaway: mongoose.Model<IGiveaway, {}, {}, {}, mongoose.Document<unknown, {}, IGiveaway, {}, {}> & IGiveaway & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Giveaway;
//# sourceMappingURL=Giveaway.d.ts.map