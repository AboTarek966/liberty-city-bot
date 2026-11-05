export interface RememberedDocument {
    name: string;
    text: string;
    ts: number;
}
export declare function rememberDocument(channelId: string, name: string, text: string): void;
export declare function getRememberedDocument(channelId: string): RememberedDocument | null;
export declare function forgetDocument(channelId: string): void;
//# sourceMappingURL=documentMemory.d.ts.map