import { Message } from 'discord.js';
/** محاولة استخراج أمر الدفع من نص رسالة المشتري. يعيد null إذا لم تكن رسالة دفع إطلاقاً. */
export declare function parseCreditCommand(text: string): {
    payeeId: string;
    amount: number;
} | null;
/** يُسجّل أمر دفع كتبه مشترٍ (بدون أي اعتماد عليه كدفع) */
export declare function recordCreditCommandAttempt(message: Message): void;
export declare function handleProbotCreditConfirmation(message: Message): Promise<void>;
//# sourceMappingURL=autoCreditFulfill.d.ts.map