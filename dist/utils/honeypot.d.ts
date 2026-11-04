import { Message } from 'discord.js';
export type HoneypotAction = 'delete' | 'timeout' | 'kick' | 'ban';
export declare function honeypotActionLabel(action: string): string;
/**
 * يعالج رسالة في قناة الطعم.
 * @returns true إذا تم اعتبار الرسالة مخالفةً وتوقّف باقي معالجة الرسالة.
 */
export declare function runHoneypot(message: Message): Promise<boolean>;
//# sourceMappingURL=honeypot.d.ts.map