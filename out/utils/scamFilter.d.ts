import { Message } from 'discord.js';
import { OmniClient } from '../OmniClient';
export interface ScamCheckResult {
    isScam: boolean;
    reason?: string;
    matched?: string;
}
/** فحص نص الرسالة بحثاً عن روابط احتيالية */
export declare function checkScamContent(content: string): ScamCheckResult;
/** معالجة رسالة واحذفها إن كانت احتيالية (يستدعيها messageCreate) */
export declare function handleScamFilter(message: Message, client: OmniClient): Promise<boolean>;
//# sourceMappingURL=scamFilter.d.ts.map