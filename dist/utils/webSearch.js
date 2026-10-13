"use strict";
// ============================================
// Liberty City Bot - Web Search Utility (مع fallback)
// يدعم: SerpAPI (مفتاح في .env) أو DuckDuckGo HTML fallback
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSearch = webSearch;
exports.formatSearchResults = formatSearchResults;
exports.formatSearchResultsForContext = formatSearchResultsForContext;
exports.formatSearchResultsBrief = formatSearchResultsBrief;
exports.searchTrend = searchTrend;
exports.searchNews = searchNews;
exports.searchAcademic = searchAcademic;
exports.searchTechnical = searchTechnical;
exports.webSearchEnhanced = webSearchEnhanced;
exports.searchYouTube = searchYouTube;
exports.fetchWebPage = fetchWebPage;
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('WebSearch');
/**
 * بحث ويب — يحاول SerpAPI أولاً (إن وُجد مفتاح)، ثم DuckDuckGo fallback
 */
async function webSearch(query, maxResults = 5) {
    // 1) جرب SerpAPI إن وُجد مفتاح
    const serpKey = process.env.SERPAPI_KEY;
    if (serpKey) {
        try {
            return await searchSerpAPI(query, maxResults, serpKey);
        }
        catch (e) {
            logger.warn('SerpAPI failed, falling back:', e);
        }
    }
    // 2) Fallback: DuckDuckGo HTML
    try {
        return await searchDuckDuckGo(query, maxResults);
    }
    catch (error) {
        logger.error('All search methods failed:', error);
        return [];
    }
}
/** بحث عبر SerpAPI (Google) — أدق النتائج */
async function searchSerpAPI(query, maxResults, apiKey) {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${maxResults}&hl=ar&gl=sa`;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`SerpAPI ${res.status}`);
    const data = await res.json();
    return (data.organic_results || []).slice(0, maxResults).map((r) => ({
        title: r.title || 'نتيجة',
        url: r.link || '',
        snippet: r.snippet || '',
    }));
}
/** بحث عبر DuckDuckGo HTML (fallback) */
async function searchDuckDuckGo(query, maxResults) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
    });
    if (!res.ok)
        throw new Error(`DDG ${res.status}`);
    const html = await res.text();
    return parseDDG(html, maxResults);
}
function parseDDG(html, max) {
    const results = [];
    const seen = new Set();
    // نمط نتائج DDG الحديث
    const regex = /<a[^>]*class="result__snippet"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < max) {
        const url = match[1];
        const snippet = match[2].replace(/<[^>]*>/g, '').trim();
        if (url && !seen.has(url) && url.startsWith('http') && !url.includes('duckduckgo')) {
            seen.add(url);
            results.push({ title: extractTitle(url), url, snippet: snippet.slice(0, 300) });
        }
    }
    // احتياطي: روابط عامة
    if (results.length === 0) {
        const linkRegex = /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([^<]{10,})<\/a>/gi;
        while ((match = linkRegex.exec(html)) !== null && results.length < max) {
            const url = match[1];
            const title = match[2].trim();
            if (!seen.has(url) && !url.includes('duckduckgo') && title.length > 5) {
                seen.add(url);
                results.push({ title: title.slice(0, 100), url, snippet: '' });
            }
        }
    }
    return results.slice(0, max);
}
function extractTitle(url) {
    try {
        return new URL(url).hostname.replace('www.', '');
    }
    catch {
        return 'نتيجة';
    }
}
function formatSearchResults(results) {
    if (results.length === 0)
        return 'لم يتم العثور على نتائج حديثة.';
    return results.map((r, i) => `${i + 1}. **${r.title}**\n   🔗 ${r.url}\n   ${r.snippet ? `📝 ${r.snippet}` : ''}`).join('\n\n');
}
/**
 * تنسيق نتائج البحث للسياق الغني (للتضمين في البرومبت)
 */
function formatSearchResultsForContext(results) {
    if (results.length === 0)
        return 'لم يتم العثور على نتائج حديثة.';
    return results.map((r, i) => `[${i + 1}] **${r.title}** (${r.url})\n   ${r.snippet ? r.snippet.slice(0, 400) : 'لا يوجد ملخص'}`).join('\n\n');
}
/**
 * تنسيق مختصر للرد المباشر للمستخدم
 */
function formatSearchResultsBrief(results) {
    if (results.length === 0)
        return '🔍 لم أجد نتائج ذات صلة.';
    return results.slice(0, 3).map((r, i) => `${i + 1}. **${r.title}** — ${r.snippet ? r.snippet.slice(0, 200) + '...' : 'بدون ملخص'}\n   🔗 ${r.url}`).join('\n\n');
}
async function searchTrend(query) {
    const r = await webSearch(`${query} ترند 2024 2025`, 3);
    return formatSearchResults(r);
}
async function searchNews(query) {
    const r = await webSearch(`${query} أخبار`, 3);
    return formatSearchResults(r);
}
/**
 * بحث أكاديمي/علمي
 */
async function searchAcademic(query) {
    const r = await webSearch(`${query} site:scholar.google.com OR site:arxiv.org OR site:researchgate.net`, 3);
    return formatSearchResults(r);
}
/**
 * بحث تقني/برمجي
 */
async function searchTechnical(query) {
    const r = await webSearch(`${query} site:stackoverflow.com OR site:github.com OR site:dev.to OR site:medium.com`, 3);
    return formatSearchResults(r);
}
/**
 * بحث عام محسّن مع محاولات متعددة
 */
async function webSearchEnhanced(query, maxResults = 5) {
    // محاولة 1: استعلام محسّن
    let results = await webSearch(query, maxResults);
    // إذا كانت النتائج قليلة، جرب استعلامات بديلة
    if (results.length < 3) {
        const alternativeQueries = [
            `${query} شرح`,
            `${query} ما هو`,
            `${query} كيف`,
            `${query} 2024 2025`,
        ];
        for (const altQuery of alternativeQueries) {
            const more = await webSearch(altQuery, maxResults - results.length);
            for (const r of more) {
                if (!results.some(existing => existing.url === r.url)) {
                    results.push(r);
                }
            }
            if (results.length >= maxResults)
                break;
        }
    }
    return results.slice(0, maxResults);
}
/**
 * البحث عن فيديو يوتيوب
 */
async function searchYouTube(query, maxResults = 3) {
    try {
        // استخدم YouTube Data API إن وُجد مفتاح، وإلا fallback لـ DuckDuckGo
        const ytKey = process.env.YOUTUBE_API_KEY;
        if (ytKey) {
            return await searchYouTubeAPI(query, maxResults, ytKey);
        }
        // Fallback: ابحث في DuckDuckGo عن "site:youtube.com"
        return await searchDuckDuckGo(`site:youtube.com ${query}`, maxResults);
    }
    catch (error) {
        logger.error('YouTube search failed:', error);
        return [];
    }
}
async function searchYouTubeAPI(query, maxResults, apiKey) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}&hl=ar`;
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`YouTube API ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((item) => ({
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        snippet: item.snippet.description?.slice(0, 300) || '',
    }));
}
/** إزالة وسوم HTML واستخراج نص مقروء */
function stripHtml(html) {
    let s = html;
    // إزالة العناصر غير النصية
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
    s = s.replace(/<!--[\s\S]*?-->/gi, ' ');
    s = s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
    // العناصر ذات المعنى → مسافات
    s = s.replace(/<\/(p|div|li|h[1-6]|tr|br|section|article|blockquote)>/gi, '\n');
    s = s.replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<li[^>]*>/gi, '\n• ');
    // إزالة كل الوسوم المتبقية
    s = s.replace(/<[^>]+>/g, ' ');
    // فك ترميز HTML
    s = s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&hellip;/g, '…')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
        .replace(/&[a-z]+;/gi, ' ');
    // تنظيف المسافات
    s = s.replace(/[ \t\r\f\v]+/g, ' ');
    s = s.replace(/\n\s*\n\s*\n+/g, '\n\n');
    return s.trim();
}
/**
 * جلب صفحة ويب واستخراج نصها المقروء — يُستخدم عندما:
 * - يُرسل المستخدم رابطاً ويريد تلخيصه/تحليله
 * - يحتاج البوت تفاصيل خارج نتائج البحث
 */
async function fetchWebPage(url, maxChars = 6000) {
    try {
        // التحقق من أن الرابط http/https فقط (أمان)
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            return { ok: false, title: '', text: '', error: 'رابط غير صالح' };
        }
        if (!/^https?:$/.test(parsed.protocol)) {
            return { ok: false, title: '', text: '', error: 'بروتوكول غير مدعوم' };
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        const res = await fetch(parsed.toString(), {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ar,en;q=0.8',
            },
        }).finally(() => clearTimeout(timer));
        if (!res.ok)
            return { ok: false, title: '', text: '', error: `HTTP ${res.status}` };
        const contentType = res.headers.get('content-type') || '';
        if (contentType && !/html|text|xml|json/i.test(contentType)) {
            return { ok: false, title: '', text: '', error: `نوع المحتوى غير نصي: ${contentType}` };
        }
        const html = await res.text();
        const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
        const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 200) : parsed.hostname;
        const text = stripHtml(html).slice(0, maxChars);
        if (!text)
            return { ok: false, title, text: '', error: 'الصفحة فارغة أو محمية' };
        logger.info(`Fetched page: ${parsed.hostname} (${text.length} chars)`);
        return { ok: true, title, text };
    }
    catch (e) {
        const msg = e?.name === 'AbortError' ? 'انتهت مهلة الجلب' : String(e?.message || e);
        logger.warn(`fetchWebPage failed for ${url}: ${msg}`);
        return { ok: false, title: '', text: '', error: msg };
    }
}
exports.default = {
    webSearch,
    webSearchEnhanced,
    formatSearchResults,
    formatSearchResultsForContext,
    formatSearchResultsBrief,
    searchTrend,
    searchNews,
    searchAcademic,
    searchTechnical,
    searchYouTube,
    fetchWebPage
};
//# sourceMappingURL=webSearch.js.map