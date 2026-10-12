// ============================================
// Liberty City Bot - Web Search Utility (مع fallback)
// يدعم: SerpAPI (مفتاح في .env) أو DuckDuckGo HTML fallback
// ============================================

import { createLogger } from './helpers';

const logger = createLogger('WebSearch');

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * بحث ويب — يحاول SerpAPI أولاً (إن وُجد مفتاح)، ثم DuckDuckGo fallback
 */
export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  // 1) جرب SerpAPI إن وُجد مفتاح
  const serpKey = process.env.SERPAPI_KEY;
  if (serpKey) {
    try {
      return await searchSerpAPI(query, maxResults, serpKey);
    } catch (e) {
      logger.warn('SerpAPI failed, falling back:', e);
    }
  }

  // 2) Fallback: DuckDuckGo HTML
  try {
    return await searchDuckDuckGo(query, maxResults);
  } catch (error) {
    logger.error('All search methods failed:', error);
    return [];
  }
}

/** بحث عبر SerpAPI (Google) — أدق النتائج */
async function searchSerpAPI(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${maxResults}&hl=ar&gl=sa`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const data: any = await res.json();
  return (data.organic_results || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || 'نتيجة',
    url: r.link || '',
    snippet: r.snippet || '',
  }));
}

/** بحث عبر DuckDuckGo HTML (fallback) */
async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const html = await res.text();
  return parseDDG(html, maxResults);
}

function parseDDG(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];
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

function extractTitle(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return 'نتيجة'; }
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return 'لم يتم العثور على نتائج حديثة.';
  return results.map((r, i) => 
    `${i + 1}. **${r.title}**\n   🔗 ${r.url}\n   ${r.snippet ? `📝 ${r.snippet}` : ''}`
  ).join('\n\n');
}

/**
 * تنسيق نتائج البحث للسياق الغني (للتضمين في البرومبت)
 */
export function formatSearchResultsForContext(results: SearchResult[]): string {
  if (results.length === 0) return 'لم يتم العثور على نتائج حديثة.';
  return results.map((r, i) => 
    `[${i + 1}] **${r.title}** (${r.url})\n   ${r.snippet ? r.snippet.slice(0, 400) : 'لا يوجد ملخص'}`
  ).join('\n\n');
}

/**
 * تنسيق مختصر للرد المباشر للمستخدم
 */
export function formatSearchResultsBrief(results: SearchResult[]): string {
  if (results.length === 0) return '🔍 لم أجد نتائج ذات صلة.';
  return results.slice(0, 3).map((r, i) => 
    `${i + 1}. **${r.title}** — ${r.snippet ? r.snippet.slice(0, 200) + '...' : 'بدون ملخص'}\n   🔗 ${r.url}`
  ).join('\n\n');
}

export async function searchTrend(query: string): Promise<string> {
  const r = await webSearch(`${query} ترند 2024 2025`, 3);
  return formatSearchResults(r);
}

export async function searchNews(query: string): Promise<string> {
  const r = await webSearch(`${query} أخبار`, 3);
  return formatSearchResults(r);
}

/**
 * بحث أكاديمي/علمي
 */
export async function searchAcademic(query: string): Promise<string> {
  const r = await webSearch(`${query} site:scholar.google.com OR site:arxiv.org OR site:researchgate.net`, 3);
  return formatSearchResults(r);
}

/**
 * بحث تقني/برمجي
 */
export async function searchTechnical(query: string): Promise<string> {
  const r = await webSearch(`${query} site:stackoverflow.com OR site:github.com OR site:dev.to OR site:medium.com`, 3);
  return formatSearchResults(r);
}

/**
 * بحث عام محسّن مع محاولات متعددة
 */
export async function webSearchEnhanced(query: string, maxResults = 5): Promise<SearchResult[]> {
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
      if (results.length >= maxResults) break;
    }
  }
  
  return results.slice(0, maxResults);
}

/**
 * البحث عن فيديو يوتيوب
 */
export async function searchYouTube(query: string, maxResults = 3): Promise<SearchResult[]> {
  try {
    // استخدم YouTube Data API إن وُجد مفتاح، وإلا fallback لـ DuckDuckGo
    const ytKey = process.env.YOUTUBE_API_KEY;
    if (ytKey) {
      return await searchYouTubeAPI(query, maxResults, ytKey);
    }
    // Fallback: ابحث في DuckDuckGo عن "site:youtube.com"
    return await searchDuckDuckGo(`site:youtube.com ${query}`, maxResults);
  } catch (error) {
    logger.error('YouTube search failed:', error);
    return [];
  }
}

async function searchYouTubeAPI(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}&hl=ar`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data: any = await res.json();
  return (data.items || []).map((item: any) => ({
    title: item.snippet.title,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    snippet: item.snippet.description?.slice(0, 300) || '',
  }));
}

export default { 
  webSearch, 
  webSearchEnhanced,
  formatSearchResults, 
  formatSearchResultsForContext,
  formatSearchResultsBrief,
  searchTrend, 
  searchNews,
  searchAcademic,
  searchTechnical,
  searchYouTube
};