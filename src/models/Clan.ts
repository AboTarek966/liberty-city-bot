// ============================================
// Omni Bot - 🛡️ نموذج العشائر
// يجمع الأعضاء في مجموعات لها أسماء، ويقيس تفاعلاتها
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

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

const ClanSchema = new Schema<IClan>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 64, trim: true },
    ownerId: { type: String, required: true },
    members: [{ type: String }],
    color: { type: Number, default: 0x3498db },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ClanSchema.index({ guildId: 1, name: 1 }, { unique: true });
ClanSchema.index({ guildId: 1, active: 1 });

export const Clan = mongoose.model<IClan>('Clan', ClanSchema);
export default Clan;
