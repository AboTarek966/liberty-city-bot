// ============================================
// Liberty City Bot - AI Knowledge Base Model
// ============================================
// قاعدة معرفة لكل سيرفر — تُحقن في سياق الذكاء الاصطناعي
// (الدردشة العامة + مساعد التذاكر) لتقليل الاعتماد على التخمين.

import mongoose, { Document, Schema } from 'mongoose';

export interface IKnowledgeEntry extends Document {
  guildId: string;
  title: string;
  content: string;
  /** وسوم تساعد في البحث — مثال: تذاكر، رولات، حماية */
  tags: string[];
  /** تصنيف اختياري */
  category: string;
  createdBy: string;
  /** عدد المرات التي استُخدمت فيها هذه المعلومة في سياق AI */
  uses: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeEntrySchema = new Schema<IKnowledgeEntry>({
  guildId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  content: { type: String, required: true, trim: true, maxlength: 8000 },
  tags: [{ type: String, trim: true, lowercase: true }],
  category: { type: String, default: 'عام', trim: true, maxlength: 50 },
  createdBy: { type: String, required: true },
  uses: { type: Number, default: 0, min: 0 },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

KnowledgeEntrySchema.index({ guildId: 1, enabled: 1 });
KnowledgeEntrySchema.index({ guildId: 1, title: 1 });
KnowledgeEntrySchema.index(
  { title: 'text', content: 'text', tags: 'text' },
  { default_language: 'none', name: 'knowledge_text' }
);

export const KnowledgeEntry = mongoose.model<IKnowledgeEntry>('KnowledgeEntry', KnowledgeEntrySchema);
export default KnowledgeEntry;
