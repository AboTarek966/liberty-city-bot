// ============================================
// Liberty City Bot - Game Stats Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IGameStats extends Document {
  guildId: string;
  userId: string;
  game: string;
  wins: number;
  losses: number;
  draws: number;
  score: number;           // نقاط إجمالية
  streak: number;          // سلسلة انتصارات
  bestStreak: number;
  lastPlayed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GameStatsSchema = new Schema<IGameStats>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  game: { type: String, required: true },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  bestStreak: { type: Number, default: 0 },
  lastPlayed: { type: Date, default: Date.now },
}, { timestamps: true });

GameStatsSchema.index({ guildId: 1, userId: 1, game: 1 }, { unique: true });

export const GameStats = mongoose.model<IGameStats>('GameStats', GameStatsSchema);
export default GameStats;