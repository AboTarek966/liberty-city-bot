import { Message } from 'discord.js';
/** هل هذه رسالة طلب تقديم على الإدارة؟ */
export declare function isApplicationIntent(content: string): boolean;
export declare function handleApplicationIntent(message: Message): Promise<boolean>;
export declare function handleCustomCommand(message: Message): Promise<boolean>;
export declare function touchTicketActivity(message: Message): Promise<void>;
export declare function earnCreditsRandom(message: Message): Promise<void>;
//# sourceMappingURL=messageSystems.d.ts.map