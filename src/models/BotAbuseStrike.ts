// ============================================
// Omni Bot - Bot Abuse Strike Model
// ============================================
// سجل الإساءات للبوت (Persistent) — يتحمل إعادة التشغيل

import mongoose, { Document, Schema } from 'mongoose';

export interface IBotAbuseStrike extends Document {
  guildId: string;
  userId: string;
  count: number;
  lastStrikeAt: Date;
}

const BotAbuseStrikeSchema = new Schema<IBotAbuseStrike>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  count: { type: Number, required: true, default: 0 },
  lastStrikeAt: { type: Date, required: true, default: () => new Date() },
}, { timestamps: true });

BotAbuseStrikeSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const BotAbuseStrike =
  mongoose.models.BotAbuseStrike ||
  mongoose.model<IBotAbuseStrike>('BotAbuseStrike', BotAbuseStrikeSchema);
