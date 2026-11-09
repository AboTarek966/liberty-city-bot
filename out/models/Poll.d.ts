import mongoose, { Document } from 'mongoose';
export interface IPollOption {
    text: string;
    votes: string[];
}
export interface IPoll extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
    ownerId: string;
    question: string;
    options: IPollOption[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Poll: mongoose.Model<IPoll, {}, {}, {}, mongoose.Document<unknown, {}, IPoll, {}, {}> & IPoll & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Poll;
//# sourceMappingURL=Poll.d.ts.map