import mongoose, { Document } from 'mongoose';
export interface IRogueBot extends Document {
    botId: string;
    reason: string;
    detectedInGuildId?: string;
    detectedById?: string;
    detectedAt: Date;
    evidence: string[];
    banCount: number;
}
export declare const RogueBot: mongoose.Model<IRogueBot, {}, {}, {}, mongoose.Document<unknown, {}, IRogueBot, {}, {}> & IRogueBot & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default RogueBot;
//# sourceMappingURL=RogueBot.d.ts.map