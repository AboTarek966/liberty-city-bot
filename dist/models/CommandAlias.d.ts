import mongoose, { Document } from 'mongoose';
export interface ICommandAlias extends Document {
    guildId: string;
    alias: string;
    command: string;
    options?: Record<string, any>;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CommandAlias: mongoose.Model<ICommandAlias, {}, {}, {}, mongoose.Document<unknown, {}, ICommandAlias, {}, {}> & ICommandAlias & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default CommandAlias;
//# sourceMappingURL=CommandAlias.d.ts.map