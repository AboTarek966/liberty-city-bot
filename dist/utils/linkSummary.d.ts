export type LinkSourceType = 'youtube' | 'web';
export interface LinkContent {
    ok: boolean;
    sourceType: LinkSourceType;
    url: string;
    title: string;
    author?: string;
    text: string;
    hasTranscript: boolean;
    error?: string;
}
export interface LinkSummaryAI {
    summary: string;
    points: string[];
    takeaway: string;
    topics: string[];
}
export interface SafeUrlResult {
    ok: boolean;
    url?: URL;
    reason?: string;
}
export declare function isSafePublicHttpUrl(raw: string): SafeUrlResult;
export declare function extractYouTubeId(raw: string): string | null;
export declare function fetchLinkContent(rawUrl: string): Promise<LinkContent>;
export declare function parseLinkSummary(raw: string): LinkSummaryAI | null;
//# sourceMappingURL=linkSummary.d.ts.map