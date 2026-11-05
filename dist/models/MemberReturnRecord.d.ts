import mongoose, { Document } from 'mongoose';
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
export declare const MemberReturnRecord: mongoose.Model<IMemberReturnRecord, {}, {}, {}, mongoose.Document<unknown, {}, IMemberReturnRecord, {}, {}> & IMemberReturnRecord & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default MemberReturnRecord;
//# sourceMappingURL=MemberReturnRecord.d.ts.map