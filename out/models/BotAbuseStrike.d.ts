import mongoose, { Document } from 'mongoose';
export interface IBotAbuseStrike extends Document {
    guildId: string;
    userId: string;
    count: number;
    lastStrikeAt: Date;
}
export declare const BotAbuseStrike: mongoose.Model<any, {}, {}, {}, any, any>;
//# sourceMappingURL=BotAbuseStrike.d.ts.map