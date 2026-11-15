import mongoose, { Document } from 'mongoose';
export interface IClan extends Document {
    guildId: string;
    name: string;
    /** عضو مشرف يعتني بها */
    ownerId: string;
    /** معرّفات الأعضاء داخل العشيرة */
    members: string[];
    /** لون تمييز (hex number مثل 0x3498db) */
    color: number;
    description: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Clan: mongoose.Model<IClan, {}, {}, {}, mongoose.Document<unknown, {}, IClan, {}, {}> & IClan & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Clan;
//# sourceMappingURL=Clan.d.ts.map