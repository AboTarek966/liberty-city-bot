export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}
/**
 * بحث ويب — يحاول SerpAPI أولاً (إن وُجد مفتاح)، ثم DuckDuckGo fallback
 */
export declare function webSearch(query: string, maxResults?: number): Promise<SearchResult[]>;
export declare function formatSearchResults(results: SearchResult[]): string;
export declare function searchTrend(query: string): Promise<string>;
export declare function searchNews(query: string): Promise<string>;
/**
 * البحث عن فيديو يوتيوب
 */
export declare function searchYouTube(query: string, maxResults?: number): Promise<SearchResult[]>;
declare const _default: {
    webSearch: typeof webSearch;
    formatSearchResults: typeof formatSearchResults;
    searchTrend: typeof searchTrend;
    searchNews: typeof searchNews;
};
export default _default;
//# sourceMappingURL=webSearch.d.ts.map