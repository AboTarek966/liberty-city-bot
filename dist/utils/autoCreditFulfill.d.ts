import { Message } from 'discord.js';
/** محاولة استخراج أمر الدفع من نص رسالة. يعيد null إذا لم تكن رسالة دفع إطلاقاً. */
export declare function parseCreditCommand(text: string): {
    payeeId: string;
    amount: number;
} | null;
/**
 * يُستدعى من معالج الرسائل لكل رسالة بشرية في السيرفر.
 * لا يلمس الرسالة إطلاقاً (لا رد ولا حذف) إلا عند تطابق تام مع طلب معلّق.
 */
export declare function handleAutoCreditTransfer(message: Message): Promise<void>;
//# sourceMappingURL=autoCreditFulfill.d.ts.map