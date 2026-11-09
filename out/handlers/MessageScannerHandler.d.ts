import { Message, Attachment } from 'discord.js';
interface ScanResult {
    clean: boolean;
    threat: string;
    details: string;
    engine: string;
}
export declare class MessageScannerHandler {
    private virusTotalApiKey;
    private scanCache;
    private readonly CACHE_TTL;
    constructor(virusTotalApiKey?: string);
    setApiKey(key: string): void;
    scanMessage(message: Message): Promise<void>;
    private extractUrls;
    scanUrl(url: string): Promise<ScanResult>;
    private submitUrlForScan;
    scanAttachment(attachment: Attachment): Promise<ScanResult>;
    private handleThreat;
    manualScanUrl(url: string): Promise<ScanResult>;
    manualScanFile(attachment: Attachment): Promise<ScanResult>;
}
export default MessageScannerHandler;
//# sourceMappingURL=MessageScannerHandler.d.ts.map