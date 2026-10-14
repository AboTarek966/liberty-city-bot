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
 * بحث ويب — سلسلة مصادر بأولوية الجودة.
 *   1) Tavily            ✅ **يعمل بلا مفتاح وبلا تسجيل** — نتائج ويب حقيقية
 *   2) Brave Search API   (إن وُجد مفتاح — 1000 استعلام/شهر، يحتاج تحقق بطاقة)
 *   3) SerpAPI            (إن وُجد مفتاح — 250 استعلام/شهر بلا بطاقة)
 *   4) ويكيبيديا          (بلا مفتاح — ضمانة دائمة للمعلومات المرجعية)
 *   5) DuckDuckGo HTML    (احتياطي — محجوب غالباً من عناوين السيرفرات)
 *
 * ⚠️ ملاحظة تشغيلية مُثبتة بالقياس (14/10/2026): كل محركات البحث الكبرى
 *    (DuckDuckGo HTML وLite، Brave HTML، Startpage، Ecosia، Mojeek، Searx)
 *    تحجب المرور الآلي من IP سيرفر — تسترجع202/403/429 أو صفحة كابتشا.
 *    لذلك Tavily (keyless) ثم ويكيبيديا هما الضمانة التي تشتغل دائماً.
 */
export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  // 1) Tavily — نتائج ويب حقيقية (أخبار/أسعار/طقس) وتعمل بلا أي مفتاح
  try {
    const t0 = Date.now();
    const r = await searchTavily(query, maxResults, process.env.TAVILY_API_KEY);
    if (r.length) {
      logger.info(`Tavily ok: ${r.length} results in ${Date.now() - t0}ms${process.env.TAVILY_API_KEY ? ' (keyed)' : ' (keyless)'}`);
      return r;
    }
    logger.warn(`Tavily returned 0 results for "${query.slice(0, 50)}"`);
  } catch (e: any) {
    logger.warn(`Tavily failed: ${e?.message || e}`);
  }

  // 2) Brave Search API — أعلى جودة إن وُجد مفتاح
  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    try {
      const r = await searchBrave(query, maxResults, braveKey);
      if (r.length) return r;
    } catch (e) {
      logger.warn('Brave Search failed:', e);
    }
  }

  // 3) SerpAPI إن وُجد مفتاح
  const serpKey = process.env.SERPAPI_KEY;
  if (serpKey) {
    try {
      const r = await searchSerpAPI(query, maxResults, serpKey);
      if (r.length) return r;
    } catch (e) {
      logger.warn('SerpAPI failed, falling back:', e);
    }
  }

  // 4) ويكيبيديا — بلا مفتاح، سريعة، ومصادر حقيقية (عربية ثم إنجليزية)
  try {
    const r = await searchWikipedia(query, maxResults);
    if (r.length) return r;
  } catch (e) {
    logger.warn('Wikipedia search failed:', e);
  }

  // 5) احتياطي أخير
  try {
    return await searchDuckDuckGo(query, maxResults);
  } catch (error) {
    logger.error('All search methods failed:', error);
    return [];
  }
}

/**
 * بحث عبر Tavily — محرك بحث مصمّم للنماذج اللغوية.
 *
 * ✅ يعمل **بلا مفتاح وبلا تسجيل** عبر ترويسة `X-Tavily-Access-Mode: keyless`
 *    (مُثبت بالقياس 14/10/2026: "سعر الذهب اليوم" أعطت أسعار 14 أكتوبر 2026
 *    الحقيقية خلال 1.4-3.3 ثانية — نتيجة ويب حقيقية لا مقالة مرجعية).
 * ⬆️ اختياري: مفتاح مجاني 1000 استعلام/شهر بلا بطاقة يرفع الحدود
 *    (يُضبط تلقائياً بمجرد إضافة TAVILY_API_KEY).
 */
async function searchTavily(query: string, maxResults: number, apiKey?: string): Promise<SearchResult[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  else headers['X-Tavily-Access-Mode'] = 'keyless';

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      max_results: Math.min(maxResults, 10),
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data: any = await res.json();
  return (data.results || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || 'نتيجة بحث',
    url: r.url || '',
    snippet: String(r.content || '').slice(0, 700),
  }));
}

/**
 * بحث عبر Brave Search API — الخطة المجانية2000 استعلام/شهر بلا بطاقة ائتمان.
 * يُفعَّل تلقائياً بمجرد إضافة BRAVE_API_KEY إلى متغيرات البيئة.
 */
async function searchBrave(query: string, maxResults: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(maxResults, 20)}&searchlang=ar&country=SA`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const data: any = await res.json();
  return (data.web?.results || []).slice(0, maxResults).map((r: any) => ({
    title: r.title || 'نتيجة',
    url: r.url || '',
    snippet: r.description || '',
  }));
}

/**
 * بحث في ويكيبيديا العربية ثم الإنجليزية — بلا مفتاح وبلا حظر.
 * يستخدم opensearch للبحث ثم summary لكل نتيجة لجلب وصف حقيقي.
 */
/** كاش بسيط لنتائج ويكيبيديا — يقلّل الطلبات ويمنع حدود الـAPI عند تكرار الأسئلة */
const wikiCache = new Map<string, { at: number; results: SearchResult[] }>();
const WIKI_CACHE_TTL = 15 * 60 * 1000;

/**
 * مُقيّد سرعة لطلبات ويكيبيديا.
 * ⚠️ مُثبت بالقياس (14/10/2026):8استعلامات متتالية بلا تباعد أعطت0نتائج للأوامر
 *    الثلاثة الأخيرة — ويكيبيديا ترفض الطلبات المتقاربة. مع تباعد400ms نجحت كلها.
 *    التباعد لا يبطئ الشيء المطلوب فردياً (طلب واحد يبقى ~0.6-2 ثانية) بل يمنع
 *    تراكم الطلبات عبر الاستعلامات المتتالية.
 */
let lastWikiCallAt = 0;
const WIKI_MIN_GAP_MS = 400;

async function wikiFetch(url: string, timeoutMs = 12_000): Promise<Response> {
  const wait = Math.max(0, lastWikiCallAt + WIKI_MIN_GAP_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastWikiCallAt = Date.now();
  return fetch(url, {
    headers: { 'User-Agent': 'LibertyCityBot/2.0 (Discord bot)' },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function searchWikipedia(query: string, maxResults = 5): Promise<SearchResult[]> {
  const cacheKey = `${query.toLowerCase()}|${maxResults}`;
  const hit = wikiCache.get(cacheKey);
  if (hit && Date.now() - hit.at < WIKI_CACHE_TTL) return hit.results;

  let out: SearchResult[] = [];

  for (const lang of ['ar', 'en']) {
    try {
      // (1) العناوين والروابط — طلب واحد
      const searchUrl =
        `https://${lang}.wikipedia.org/w/api.php?action=opensearch` +
        `&search=${encodeURIComponent(query)}&limit=${maxResults}&namespace=0&format=json&origin=*`;

      const res = await wikiFetch(searchUrl);
      if (!res.ok) continue;

      const data: any = await res.json();
      const titles: string[] = data?.[1] || [];
      const links: string[] = data?.[3] || [];
      if (!titles.length) continue;

      // (2) الأوصاف لكل العناوين في طلب واحد.
      //     ⚠️ الطريقة القديمة كانت ملخصاً لكل عنوان (=5طلبات) فاستنزفت حدود الـAPI
      //        وسبّبت رفض الاستعلامات التالية بصمت.
      const extracts = new Map<string, string>();
      try {
        const exUrl =
          `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts` +
          `&exintro&explaintext&exsentences=2&redirects=1` +
          `&titles=${encodeURIComponent(titles.slice(0, maxResults).join('|'))}` +
          `&format=json&origin=*`;

        const exRes = await wikiFetch(exUrl);
        if (exRes.ok) {
          const exData: any = await exRes.json();
          for (const p of Object.values<any>(exData?.query?.pages || {})) {
            if (p?.title && typeof p.extract === 'string') {
              extracts.set(p.title, p.extract.trim());
              // redirects=1 يُعيد العنوان بعد التوجيه ("مكة المكرمة"→"مكة")
              // نربطه أيضاً بالعنوان الذي طلبناه حتى لا تضيع الأوصاف.
              const red = (exData?.query?.redirects || []).find((r: any) => r.to === p.title);
              if (red?.from) extracts.set(red.from, p.extract.trim());
            }
          }
        }
      } catch (e: any) {
        logger.warn(`Wikipedia extracts ${lang} failed: ${e?.message || e}`);
      }

      out = titles.slice(0, maxResults).map((title, i) => {
        const extract = extracts.get(title) || '';
        return {
          title: `${title} — ويكيبيديا${lang === 'ar' ? ' العربية' : ''}`,
          url: links[i] || '',
          snippet: extract || 'نتيجة من ويكيبيديا',
        };
      });

      if (out.length) break; // العربية كفيلة — لا نُطيل بالإنجليزية
    } catch (e: any) {
      logger.warn(`Wikipedia ${lang} failed: ${e?.message || e}`);
    }
  }

  out = out.slice(0, maxResults);
  if (out.length) wikiCache.set(cacheKey, { at: Date.now(), results: out });
  return out;
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
 * بحث عام محسّن مع محاولات محدودة.
 *
 * ⚠️ تعديل مهم: نُضيف الاستعلامات البديلة فقط إذا كان المصدر الأساسي
 *    أرجع نتائج أصلاً. سلوكه القديم كان يُطلق4استعلامات بديلة بعد كل فشل —
 *    وكل واحد يفشل بعد ~1-2 ثانية (حظر) — فيستهلك ~15 ثانية بلا فائدة.
 */
export async function webSearchEnhanced(query: string, maxResults = 5): Promise<SearchResult[]> {
  const results = await webSearch(query, maxResults);
  if (!results.length || results.length >= maxResults) return results.slice(0, maxResults);

  // المصدر أرجع شيئاً → نُوسّع ببديل واحد فقط (لا نُبطئ الرد)
  const alternativeQueries = [`${query} شرح`, `${query} 2025 2026`];

  for (const altQuery of alternativeQueries) {
    const more = await webSearch(altQuery, maxResults - results.length);
    for (const r of more) {
      if (!results.some((existing) => existing.url === r.url)) results.push(r);
    }
    if (results.length >= maxResults) break;
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

// --------------------------------------------
// 🌐 قراءة صفحة ويب كاملة (لما يعطي المستخدم رابطاً أو يحتاج البوت تفاصيل)
// --------------------------------------------
export interface PageContent {
  ok: boolean;
  title: string;
  text: string;
  error?: string;
}

/** إزالة وسوم HTML واستخراج نص مقروء */
function stripHtml(html: string): string {
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
export async function fetchWebPage(url: string, maxChars = 6000): Promise<PageContent> {
  try {
    // التحقق من أن الرابط http/https فقط (أمان)
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
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
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.8',
      },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return { ok: false, title: '', text: '', error: `HTTP ${res.status}` };

    const contentType = res.headers.get('content-type') || '';
    if (contentType && !/html|text|xml|json/i.test(contentType)) {
      return { ok: false, title: '', text: '', error: `نوع المحتوى غير نصي: ${contentType}` };
    }

    const html = await res.text();
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch ? stripHtml(titleMatch[1]).slice(0, 200) : parsed.hostname;

    const text = stripHtml(html).slice(0, maxChars);
    if (!text) return { ok: false, title, text: '', error: 'الصفحة فارغة أو محمية' };

    logger.info(`Fetched page: ${parsed.hostname} (${text.length} chars)`);
    return { ok: true, title, text };
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'انتهت مهلة الجلب' : String(e?.message || e);
    logger.warn(`fetchWebPage failed for ${url}: ${msg}`);
    return { ok: false, title: '', text: '', error: msg };
  }
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
  searchYouTube,
  fetchWebPage
};