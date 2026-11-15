import mongoose, { Document } from 'mongoose';
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
export declare const ClanBattle: mongoose.Model<IClanBattle, {}, {}, {}, mongoose.Document<unknown, {}, IClanBattle, {}, {}> & IClanBattle & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default ClanBattle;
//# sourceMappingURL=ClanBattle.d.ts.map