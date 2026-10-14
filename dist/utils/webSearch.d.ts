export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}
/**
 * بحث ويب — سلسلة مصادر بأولوية الجودة.
 *   1) Brave Search API   (إن وُجد مفتاح — مجاني2000 استعلام/شهر بلا بطاقة)
 *   2) SerpAPI            (إن وُجد مفتاح)
 *   3) ويكيبيديا          (بلا مفتاح — المصدر الوحيد الذي يسمح للمرور الآلي فعلاً)
 *   4) DuckDuckGo HTML    (احتياطي — محجوب غالباً من عناوين السيرفرات)
 *
 * ⚠️ ملاحظة تشغيلية مُثبتة بالقياس (14/10/2026): كل محركات البحث الكبرى
 *    (DuckDuckGo HTML وLite، Brave HTML، Startpage، Ecosia، Mojeek، Searx)
 *    تحجب المرور الآلي من IP سيرفر — تسترجع202/403/429 أو صفحة كابتشا.
 *    لذلك ويكيبيديا هي الضمانة التي تشتغل دائماً بلا مفتاح وبلا إعداد.
 */
export declare function webSearch(query: string, maxResults?: number): Promise<SearchResult[]>;
export declare function searchWikipedia(query: string, maxResults?: number): Promise<SearchResult[]>;
export declare function formatSearchResults(results: SearchResult[]): string;
/**
 * تنسيق نتائج البحث للسياق الغني (للتضمين في البرومبت)
 */
export declare function formatSearchResultsForContext(results: SearchResult[]): string;
/**
 * تنسيق مختصر للرد المباشر للمستخدم
 */
export declare function formatSearchResultsBrief(results: SearchResult[]): string;
export declare function searchTrend(query: string): Promise<string>;
export declare function searchNews(query: string): Promise<string>;
/**
 * بحث أكاديمي/علمي
 */
export declare function searchAcademic(query: string): Promise<string>;
/**
 * بحث تقني/برمجي
 */
export declare function searchTechnical(query: string): Promise<string>;
/**
 * بحث عام محسّن مع محاولات محدودة.
 *
 * ⚠️ تعديل مهم: نُضيف الاستعلامات البديلة فقط إذا كان المصدر الأساسي
 *    أرجع نتائج أصلاً. سلوكه القديم كان يُطلق4استعلامات بديلة بعد كل فشل —
 *    وكل واحد يفشل بعد ~1-2 ثانية (حظر) — فيستهلك ~15 ثانية بلا فائدة.
 */
export declare function webSearchEnhanced(query: string, maxResults?: number): Promise<SearchResult[]>;
/**
 * البحث عن فيديو يوتيوب
 */
export declare function searchYouTube(query: string, maxResults?: number): Promise<SearchResult[]>;
export interface PageContent {
    ok: boolean;
    title: string;
    text: string;
    error?: string;
}
/**
 * جلب صفحة ويب واستخراج نصها المقروء — يُستخدم عندما:
 * - يُرسل المستخدم رابطاً ويريد تلخيصه/تحليله
 * - يحتاج البوت تفاصيل خارج نتائج البحث
 */
export declare function fetchWebPage(url: string, maxChars?: number): Promise<PageContent>;
declare const _default: {
    webSearch: typeof webSearch;
    webSearchEnhanced: typeof webSearchEnhanced;
    formatSearchResults: typeof formatSearchResults;
    formatSearchResultsForContext: typeof formatSearchResultsForContext;
    formatSearchResultsBrief: typeof formatSearchResultsBrief;
    searchTrend: typeof searchTrend;
    searchNews: typeof searchNews;
    searchAcademic: typeof searchAcademic;
    searchTechnical: typeof searchTechnical;
    searchYouTube: typeof searchYouTube;
    fetchWebPage: typeof fetchWebPage;
};
export default _default;
//# sourceMappingURL=webSearch.d.ts.map