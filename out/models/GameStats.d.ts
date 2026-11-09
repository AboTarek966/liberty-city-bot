import mongoose, { Document } from 'mongoose';
export interface IGameStats extends Document {
    guildId: string;
    userId: string;
    game: string;
    wins: number;
    losses: number;
    draws: number;
    score: number;
    streak: number;
    bestStreak: number;
    lastPlayed: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const GameStats: mongoose.Model<IGameStats, {}, {}, {}, mongoose.Document<unknown, {}, IGameStats, {}, {}> & IGameStats & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default GameStats;
//# sourceMappingURL=GameStats.d.ts.map