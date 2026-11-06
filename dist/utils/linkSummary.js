"use strict";
// ============================================
// Omni Bot - Link / Video Reader
// ============================================
// يقرأ صفحات الويب ويستخرج نص فيديوهات يوتيوب (Caption/Transcript)
// قبل إرسال المحتوى إلى الذكاء الاصطناعي للتلخيص.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSafePublicHttpUrl = isSafePublicHttpUrl;
exports.extractYouTubeId = extractYouTubeId;
exports.fetchLinkContent = fetchLinkContent;
exports.parseLinkSummary = parseLinkSummary;
const webSearch_1 = require("./webSearch");
const aiJson_1 = require("./aiJson");
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    'Accept-Language': 'ar,en;q=0.8',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};
function isSafePublicHttpUrl(raw) {
    const value = String(raw || '').trim();
    if (!value)
        return { ok: false, reason: 'الرابط فارغ' };
    if (value.length > 500)
        return { ok: false, reason: 'الرابط طويل جداً' };
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        return { ok: false, reason: 'رابط غير صالح' };
    }
    if (!/^https?:$/.test(parsed.protocol)) {
        return { ok: false, reason: 'يُسمح بروابط http/https فقط' };
    }
    if (parsed.username || parsed.password) {
        return { ok: false, reason: 'الروابط التي تحتوي بيانات دخول غير مسموحة' };
    }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host || host === 'localhost' || host.endsWith('.localhost')) {
        return { ok: false, reason: 'هذا العنوان محلي وغير مسموح' };
    }
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
        return { ok: false, reason: 'هذا عنوان شبكة داخلية وغير مسموح' };
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        const [a, b] = host.split('.').map(Number);
        const isPrivate = a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 192 && b === 168) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 100 && b >= 64 && b <= 127);
        if (isPrivate)
            return { ok: false, reason: 'عناوين IP الخاصة غير مسموحة' };
    }
    if (host.includes(':')) {
        const isPrivateV6 = host === '::1' ||
            host === '::' ||
            /^f[cd]/i.test(host) ||
            /^fe[89ab]/i.test(host);
        if (isPrivateV6)
            return { ok: false, reason: 'عناوين IP الخاصة غير مسموحة' };
    }
    // اسم مضيف بلا نقطة = شبكة داخلية غالباً
    if (!host.includes('.') && !host.includes(':')) {
        return { ok: false, reason: 'اسم النطاق غير صالح' };
    }
    return { ok: true, url: parsed };
}
// --------------------------------------------
// YouTube
// --------------------------------------------
function extractYouTubeId(raw) {
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        return null;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const isYouTube = host === 'youtu.be' ||
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'music.youtube.com' ||
        host.endsWith('.youtube.com') ||
        host === 'youtube-nocookie.com' ||
        host.endsWith('.youtube-nocookie.com');
    if (!isYouTube)
        return null;
    let id = '';
    if (host === 'youtu.be') {
        id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    }
    else if (parsed.pathname === '/watch') {
        id = parsed.searchParams.get('v') || '';
    }
    else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (['shorts', 'embed', 'live', 'v'].includes(parts[0] || '')) {
            id = parts[1] || '';
        }
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}
function decodeHtmlEntities(input) {
    const once = String(input || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;|&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
    // بعض ترجمات يوتيوب تُرمَّز مرتين (&amp;#39;)
    return once
        .replace(/&amp;/g, '&')
        .replace(/&#0*39;|&apos;/g, "'")
        .replace(/&quot;/g, '"');
}
function parseCaptionBody(body) {
    try {
        const data = JSON.parse(body);
        const events = Array.isArray(data?.events) ? data.events : [];
        const text = events
            .map((event) => Array.isArray(event?.segs)
            ? event.segs.map((segment) => String(segment?.utf8 || '')).join('')
            : '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (text)
            return text;
    }
    catch {
        // ليس JSON3 — نجرّب XML
    }
    const matches = [...body.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)];
    return decodeHtmlEntities(matches.map((match) => match[1] || '').join(' '))
        .replace(/\s+/g, ' ')
        .trim();
}
function trackScore(track) {
    const language = String(track?.languageCode || '').toLowerCase();
    let score = 0;
    if (language.startsWith('ar'))
        score += 100;
    else if (language.startsWith('en'))
        score += 50;
    if (String(track?.kind || '') !== 'asr')
        score += 10;
    return score;
}
async function fetchTranscript(tracks, videoId) {
    const candidates = tracks
        .filter((track) => track?.baseUrl)
        .sort((a, b) => trackScore(b) - trackScore(a))
        .slice(0, 3);
    // يوتيوب يرجّع 200 بجسم فارغ لطلبات الترجمات بدون ترويسات متصفح كاملة
    const headers = {
        ...BROWSER_HEADERS,
        Referer: `https://www.youtube.com/watch?v=${videoId}`,
        Origin: 'https://www.youtube.com',
        Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+123; SOCS=CAI',
    };
    for (const track of candidates) {
        try {
            const url = new URL(String(track.baseUrl).replace(/\\u0026/g, '&'));
            url.searchParams.set('fmt', 'json3');
            const response = await fetch(url.toString(), {
                headers,
                signal: AbortSignal.timeout(15_000),
            });
            if (!response.ok)
                continue;
            const body = await response.text();
            if (!body || body.length < 20)
                continue;
            const transcript = parseCaptionBody(body);
            if (transcript.length >= 20)
                return transcript;
        }
        catch {
            // نجرّب المسار التالي
        }
    }
    return '';
}
function extractJsonString(html, key) {
    const match = html.match(new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`, 's'));
    if (!match)
        return '';
    try {
        return JSON.parse(`"${match[1]}"`);
    }
    catch {
        return decodeHtmlEntities(match[1]);
    }
}
/**
 * يستخرج أول مصفوفة JSON بعد مفتاح معيّن مع موازنة الأقواس.
 * (regex بسيط يفشل لأن عناصر captionTracks تحتوي مصفوفات داخلية مثل translationLanguages)
 */
function extractJsonArrayAfterKey(html, key) {
    const marker = `"${key}":`;
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0)
        return '';
    let index = markerIndex + marker.length;
    while (index < html.length && /\s/.test(html[index]))
        index++;
    if (html[index] !== '[')
        return '';
    const start = index;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; index < html.length; index++) {
        const char = html[index];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (char === '\\')
                escaped = true;
            else if (char === '"')
                inString = false;
        }
        else if (char === '"') {
            inString = true;
        }
        else if (char === '[') {
            depth++;
        }
        else if (char === ']') {
            depth--;
            if (depth === 0)
                return html.slice(start, index + 1);
        }
    }
    return '';
}
async function readYouTube(videoId, url) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=ar&gl=SA`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const [oembedResult, pageResult] = await Promise.allSettled([
        fetch(oembedUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(10_000) }),
        fetch(watchUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(20_000) }),
    ]);
    let title = '';
    let author = '';
    if (oembedResult.status === 'fulfilled' && oembedResult.value.ok) {
        try {
            const data = await oembedResult.value.json();
            title = String(data?.title || '').trim();
            author = String(data?.author_name || '').trim();
        }
        catch {
            // نتجاهل
        }
    }
    let description = '';
    let transcript = '';
    if (pageResult.status === 'fulfilled' && pageResult.value.ok) {
        const html = await pageResult.value.text().catch(() => '');
        if (!title) {
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (titleMatch) {
                title = decodeHtmlEntities(titleMatch[1]).replace(/\s*-\s*YouTube\s*$/i, '').trim();
            }
        }
        description = extractJsonString(html, 'shortDescription');
        const tracksRaw = extractJsonArrayAfterKey(html, 'captionTracks');
        if (tracksRaw) {
            try {
                const tracks = JSON.parse(tracksRaw);
                transcript = await fetchTranscript(tracks, videoId);
            }
            catch {
                // لا توجد ترجمة قابلة للقراءة
            }
        }
    }
    const textParts = [
        transcript ? `نص الفيديو:\n${transcript.slice(0, 18_000)}` : '',
        description ? `وصف الفيديو:\n${description.slice(0, 2_000)}` : '',
    ].filter(Boolean);
    const text = textParts.join('\n\n').trim();
    if (!text) {
        return {
            ok: false,
            sourceType: 'youtube',
            url,
            title: title || 'فيديو يوتيوب',
            author,
            text: '',
            hasTranscript: false,
            error: 'لم أستطع قراءة نص الفيديو — لا توجد ترجمة أو وصف متاح',
        };
    }
    return {
        ok: true,
        sourceType: 'youtube',
        url,
        title: title || 'فيديو يوتيوب',
        author,
        text,
        hasTranscript: Boolean(transcript),
    };
}
// --------------------------------------------
// Generic page
// --------------------------------------------
async function fetchLinkContent(rawUrl) {
    const safe = isSafePublicHttpUrl(rawUrl);
    if (!safe.ok || !safe.url) {
        return {
            ok: false,
            sourceType: 'web',
            url: rawUrl,
            title: '',
            text: '',
            hasTranscript: false,
            error: safe.reason || 'رابط غير مسموح',
        };
    }
    const url = safe.url.toString();
    const videoId = extractYouTubeId(url);
    if (videoId) {
        try {
            return await readYouTube(videoId, url);
        }
        catch (error) {
            return {
                ok: false,
                sourceType: 'youtube',
                url,
                title: 'فيديو يوتيوب',
                text: '',
                hasTranscript: false,
                error: String(error?.message || error),
            };
        }
    }
    const page = await (0, webSearch_1.fetchWebPage)(url, 16_000);
    if (!page.ok || !page.text) {
        return {
            ok: false,
            sourceType: 'web',
            url,
            title: page.title || '',
            text: '',
            hasTranscript: false,
            error: page.error || 'تعذّرت قراءة الصفحة',
        };
    }
    return {
        ok: true,
        sourceType: 'web',
        url,
        title: page.title || safe.url.hostname,
        text: page.text,
        hasTranscript: false,
    };
}
// --------------------------------------------
// Summary parsing
// --------------------------------------------
function parseLinkSummary(raw) {
    const data = (0, aiJson_1.extractJsonObject)(raw);
    if (!data || typeof data !== 'object')
        return null;
    const summary = String(data.summary || '').trim().slice(0, 3_500);
    const takeaway = String(data.takeaway || '').trim().slice(0, 1_000);
    if (!summary && !takeaway)
        return null;
    return {
        summary,
        points: (0, aiJson_1.toStringArray)(data.points, 7, 320),
        takeaway,
        topics: (0, aiJson_1.toStringArray)(data.topics, 8, 60),
    };
}
//# sourceMappingURL=linkSummary.js.map