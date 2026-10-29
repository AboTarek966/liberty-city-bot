// ============================================
// Liberty City Bot - Cross-Guild Rogue Bot Blacklist
// بوتات تمت تحييدها في سيرفر واحد → تُحظر فوراً في كل السيرفرات (تخزين دائم).
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IRogueBot extends Document {
  botId: string;
  reason: string;
  detectedInGuildId?: string;
  detectedById?: string;
  detectedAt: Date;
  evidence: string[];
  banCount: number;
}

const RogueBotSchema = new Schema<IRogueBot>({
  botId: { type: String, required: true, unique: true, index: true },
  reason: { type: String, default: 'rogue bot' },
  detectedInGuildId: { type: String },
  detectedById: { type: String },
  detectedAt: { type: Date, default: Date.now },
  evidence: [{ type: String }],
  banCount: { type: Number, default: 1 },
}, { timestamps: true });

export const RogueBot = mongoose.model<IRogueBot>('RogueBot', RogueBotSchema);
export default RogueBot;
