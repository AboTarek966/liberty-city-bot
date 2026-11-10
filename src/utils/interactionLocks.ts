// ============================================
// Omni Bot - Interaction Locks (MongoDB)
// يمنع معالجة نفس التفاعل (ضغطة زر/منيو) أكثر من مرة — عبر كل نسخ البوت
// ============================================
// لماذا؟ ديسكورد (وماثله من البوابات) قد يوزع نفس الحدث على أكثر من نسخة
// شغالة بنفس التوكن — كل نسخة كانت تعالج الضغطة فتضيف وتزيل العضو وبالتالي ي
//تذبذب العدد بين 0 و 1. القيد الفريد هنا يجعل الضغطة تُعالج مرة واحدة فقط.

import mongoose from 'mongoose';
import { createLogger } from './helpers';

const logger = createLogger('InteractionLocks');

const InteractionLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 6, index: true }, // حذف تلقائي بعد 6 ساعات
  },
  { versionKey: false }
);

const InteractionLock =
  (mongoose.models.InteractionLock as mongoose.Model<any>) ||
  mongoose.model('InteractionLock', InteractionLockSchema);

/**
 * يحاول حجز هذا التفاعل — يعيد true إن كان أول من يحجزه، و false إن كان محجوزاً سلفاً.
 * عند فشل قاعدة البيانات لا نمنع المستخدم من التنفيذ (fail-open) حتى لا يتعطل التفاعل.
 */
export async function claimInteractionOnce(interactionId: string): Promise<boolean> {
  if (!interactionId) return true;
  try {
    const res = await InteractionLock.updateOne(
      { _id: interactionId },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    return res.upsertedCount === 1;
  } catch (error: any) {
    // E11000 = duplicate key → التفاعل محجوز سلفاً لهذه اللحظة — لا تعالجها مرة ثانية
    if (error?.code === 11000 || error?.code === 11001) return false;
    logger.warn(`claimInteractionOnce(${interactionId}) failed: ${error?.message || error}`);
    return true;
  }
}
