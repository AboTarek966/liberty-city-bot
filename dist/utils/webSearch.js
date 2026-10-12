"use strict";
// ============================================
// Liberty City Bot - Web Search Utility (مع fallback)
// يدعم: SerpAPI (مفتاح في .env) أو DuckDuckGo HTML fallback
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSearch = webSearch;
exports.formatSearchResults = formatSearchResults;
exports.searchTrend = searchTrend;
exports.searchNews = searchNews;
exports.searchYouTube = searchYouTube;
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
async function searchTrend(query) {
    const r = await webSearch(`${query} ترند 2024 2025`, 3);
    return formatSearchResults(r);
}
async function searchNews(query) {
    const r = await webSearch(`${query} أخبار`, 3);
    return formatSearchResults(r);
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
exports.default = { webSearch, formatSearchResults, searchTrend, searchNews };
//# sourceMappingURL=webSearch.js.map