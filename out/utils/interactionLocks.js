"use strict";
// ============================================
// Omni Bot - Interaction Locks (MongoDB)
// يمنع معالجة نفس التفاعل (ضغطة زر/منيو) أكثر من مرة — عبر كل نسخ البوت
// ============================================
// لماذا؟ ديسكورد (وماثله من البوابات) قد يوزع نفس الحدث على أكثر من نسخة
// شغالة بنفس التوكن — كل نسخة كانت تعالج الضغطة فتضيف وتزيل العضو وبالتالي ي
//تذبذب العدد بين 0 و 1. القيد الفريد هنا يجعل الضغطة تُعالج مرة واحدة فقط.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimInteractionOnce = claimInteractionOnce;
const mongoose_1 = __importDefault(require("mongoose"));
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('InteractionLocks');
const InteractionLockSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 6, index: true }, // حذف تلقائي بعد 6 ساعات
}, { versionKey: false });
const InteractionLock = mongoose_1.default.models.InteractionLock ||
    mongoose_1.default.model('InteractionLock', InteractionLockSchema);
/**
 * يحاول حجز هذا التفاعل — يعيد true إن كان أول من يحجزه، و false إن كان محجوزاً سلفاً.
 * عند فشل قاعدة البيانات لا نمنع المستخدم من التنفيذ (fail-open) حتى لا يتعطل التفاعل.
 */
async function claimInteractionOnce(interactionId) {
    if (!interactionId)
        return true;
    try {
        const res = await InteractionLock.updateOne({ _id: interactionId }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
        return res.upsertedCount === 1;
    }
    catch (error) {
        logger.warn(`claimInteractionOnce(${interactionId}) failed: ${error?.message || error}`);
        return true;
    }
}
//# sourceMappingURL=interactionLocks.js.map