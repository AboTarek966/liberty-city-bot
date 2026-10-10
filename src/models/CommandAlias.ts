// ============================================
// Liberty City Bot - Command Alias Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface ICommandAlias extends Document {
  guildId: string;
  alias: string;           // المختصر (مثلاً: !ban)
  command: string;         // الأمر الأصلي (مثلاً: ban)
  options?: Record<string, any>; // خيارات افتراضية
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommandAliasSchema = new Schema<ICommandAlias>({
  guildId: { type: String, required: true, index: true },
  alias: { type: String, required: true },
  command: { type: String, required: true },
  options: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: String, required: true },
}, { timestamps: true });

// Compound index for guild + alias uniqueness
CommandAliasSchema.index({ guildId: 1, alias: 1 }, { unique: true });

export const CommandAlias = mongoose.model<ICommandAlias>('CommandAlias', CommandAliasSchema);
export default CommandAlias;