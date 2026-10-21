"use strict";
// ============================================
// Liberty City Bot - Music Handler
// نظام موسيقى حقيقي: SoundCloud (عبر ffmpeg) أساسي + يوتيوب Innertube احتياطي
// SoundCloud يعمل من أي IP بما فيها سيرفرات الاستضافة المجانية التي يحجبها يوتيوب
// البحث عبر youtube-sr، ودعم كامل: تشغيل/إيقاف/استئناف/تخطي/seek/صوت/تكرار
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.musicHandler = exports.MusicHandler = void 0;
const voice_1 = require("@discordjs/voice");
const youtube_sr_1 = require("youtube-sr");
const stream_1 = require("stream");
const child_process_1 = require("child_process");
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('MusicHandler');
// --------------------------------------------
// YouTube Innertube API (احتياطي — لا يحتاج مفاتيح)
// --------------------------------------------
const YT_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const YT_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';
async function innertube(path, body) {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/${path}?key=${YT_KEY}&prettyPrint=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': YT_UA },
        body: JSON.stringify(body),
    });
    if (!res.ok)
        throw new Error(`innertube ${path} HTTP ${res.status}`);
    return res.json();
}
// يجمع كل compactVideoRenderer من شجرة الاستجابة
function collectCompactVideos(node, out) {
    if (!node || typeof node !== 'object')
        return;
    if (Array.isArray(node)) {
        for (const item of node)
            collectCompactVideos(item, out);
        return;
    }
    if (node.compactVideoRenderer)
        out.push(node.compactVideoRenderer);
    for (const key of Object.keys(node))
        collectCompactVideos(node[key], out);
}
// "3:45" أو "1:02:03" → ثوانٍ
function parseClockDuration(text) {
    if (!text)
        return 0;
    const parts = text.split(':').map((p) => parseInt(p, 10));
    if (parts.some(isNaN))
        return 0;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
}
// تطبيع الحروف العربية (أ/إ/آ→ا، ة→ه، ئ/ى→ي، حذف التشكيل)
// يساعد يوتيوب على إيجاد النتائج مع اختلاف الكتابة
function normalizeArabic(text) {
    return text
        .replace(/[\u064B-\u0652\u0670]/g, '') // تشكيل
        .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ → ا
        .replace(/\u0649/g, '\u064A') // ى → ي
        .replace(/\u0626/g, '\u064A') // ئ → ي
        .replace(/\u0629/g, '\u0647') // ة → ه
        .replace(/\u0640/g, '') // تطويل
        .replace(/\s+/g, ' ')
        .trim();
}
// معرّف الفيديو من أي صيغة رابط يوتيوب
function extractVideoId(url) {
    const m = url.match(/[?&]v=([\w-]{11})/) ||
        url.match(/youtu\.be\/([\w-]{11})/) ||
        url.match(/shorts\/([\w-]{11})/) ||
        url.match(/embed\/([\w-]{11})/);
    return m ? m[1] : null;
}
// --------------------------------------------
// ffmpeg — لتحويل بث SoundCloud (AAC/HMP4) إلى PCM يفهمه Discord
// نجرّب "ffmpeg -version" لنظام التشغيل أولاً (المُثبت نجاحه هنا فعلياً)،
// ثم المثبّت npm احتياطاً. النسخ الثابتة جرى تجربتها و انهارت بـ SIGSEGV.
// --------------------------------------------
let FFMPEG_PATH = 'ffmpeg';
let FFMPEG_OK = false;
// لا نُنزّل نسخة ثابتة: جُرِّبت على هذه الاستضافة و انهارت بـ SIGSEGV أيضاً.
// ffmpeg نظام التشغيل هو الوحيد المُثبت نجاحه، والمثبّت احتياطي مع retry.
async function initFfmpeg() {
    if (FFMPEG_OK)
        return;
    // لا شيء جاهز — نعتمد المسار الحالي مهما كان (retry في startSoundcloud يحمينا)
    FFMPEG_OK = true;
    logger.warn(`⚠️ ffmpeg fallback in use (may crash intermittently): ${FFMPEG_PATH}`);
}
// اختيار أولي متزامن — الترتيب مبني على نتائج فعلية على هذه الاستضافة:
// 1) ffmpeg نظام التشغيل: الوحيد الذي نجح فعلياً مع SoundCloud (50947KB PCM)
// 2) @ffmpeg-installer: ينهار أحياناً بـ SIGSEGV عند فك ترميز HLS (يُعالج بـ retry)
{
    const fsMod = require('fs');
    let sysOk = false;
    try {
        const p = (0, child_process_1.spawnSync)('ffmpeg', ['-hide_banner', '-version'], {
            windowsHide: true,
            timeout: 15000,
            stdio: ['ignore', 'ignore', 'ignore'],
        });
        sysOk = p.status === 0;
    }
    catch {
        sysOk = false;
    }
    if (sysOk) {
        FFMPEG_PATH = 'ffmpeg';
        FFMPEG_OK = true;
        logger.info('ffmpeg: using system binary (only one proven working with SoundCloud on this host)');
    }
    else {
        try {
            const inst = require('@ffmpeg-installer/ffmpeg');
            if (inst?.path && fsMod.existsSync(inst.path)) {
                // حماية: بعض الاستضافات تمنع سكربت postinstall (chmod u+x) — نمنح الصلاحية بأنفسنا
                try {
                    fsMod.chmodSync(inst.path, 0o755);
                }
                catch { /* قد تكون منحتة مسبقاً */ }
                FFMPEG_PATH = inst.path;
            }
        }
        catch {
            /* الحزمة غير مثبتة — نعتمد على ffmpeg في PATH */
        }
        logger.warn('ffmpeg: system binary unavailable — using npm installer build (intermittent SIGSEGV risk, retries in place)');
    }
}
// --------------------------------------------
// SoundCloud — مصدر أساسي للبث الصوتي
// يعمل من أي عنوان IP (بخلاف يوتيوب الذي يحجب سيرفرات الاستضافة)
// --------------------------------------------
const SC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
let scClientId = null;
let scClientIdAt = 0;
// يجلب client_id من صفحة SoundCloud (يتغيّر نادراً — نخزّنه 6 ساعات)
async function scGetClientId() {
    if (scClientId && Date.now() - scClientIdAt < 6 * 60 * 60 * 1000)
        return scClientId;
    const r = await fetch('https://soundcloud.com', {
        headers: { 'User-Agent': SC_UA },
        signal: AbortSignal.timeout(15000),
    });
    const html = await r.text();
    const scripts = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
    for (const s of scripts.reverse().slice(0, 8)) {
        const js = await fetch(s, { headers: { 'User-Agent': SC_UA }, signal: AbortSignal.timeout(15000) })
            .then((x) => x.text())
            .catch(() => '');
        const m = js.match(/client_id[:=]"([a-zA-Z0-9]{32})"/);
        if (m) {
            scClientId = m[1];
            scClientIdAt = Date.now();
            logger.info(`SoundCloud client_id refreshed: ${scClientId}`);
            return scClientId;
        }
    }
    throw new Error('soundcloud client_id not found');
}
// بحث عن الأغاني — يرجع أول نتيجة قابلة للتشغيل
async function scSearchTracks(query, limit = 6) {
    const cid = await scGetClientId();
    const r = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${cid}&limit=${limit}`, { headers: { 'User-Agent': SC_UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok)
        throw new Error(`soundcloud search HTTP ${r.status}`);
    const d = await r.json();
    return (d.collection || []).filter((t) => t.media?.transcodings?.length);
}
// يحوّل ترميز الأغنية إلى رابط بث موقّع (HLS m3u8) — يُستدعى وقت التشغيل
// (روابط الـ transcodings تنتهي صلاحيتها سريعاً)
async function scResolveStream(transcodingUrl) {
    const cid = await scGetClientId();
    const r = await fetch(`${transcodingUrl}?client_id=${cid}`, {
        headers: { 'User-Agent': SC_UA },
        signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
        return null;
    const d = await r.json().catch(() => ({}));
    return d?.url || null;
}
// يختار ترميز HLS المناسب (AAC في حاوية MP4 — لا يوجد progressive MP3)
function scPickHls(transcodings) {
    return (transcodings.find((x) => x.format?.protocol === 'hls' && (x.format?.mime_type || '').startsWith('audio/mp4')) || transcodings.find((x) => x.format?.protocol === 'hls') || null);
}
class MusicHandler {
    client;
    queues = new Map();
    players = new Map();
    connections = new Map();
    // عدّاد للتوقفات اليدوية (تخطي/إيقاف) حتى لا يتولى الـ Idle تقدُماً إضافياً
    manualStops = new Map();
    // نقطة بداية البث الحالية (بالميلي ثانية) — لحساب الموضع الحالي ودعم تقديم/إرجاع
    seekOffsets = new Map();
    // عمليات ffmpeg النشطة لكل سيرفر (لإيقافها عند التخطي/الإيقاف/المغادرة)
    ffprocs = new Map();
    // مدة التشغيل الفعلية عند آخر انتهاء (للكشف عن الفشل المبكر ومنع تكرار لا نهائي)
    lastPlayMs = new Map();
    constructor(client) {
        this.client = client;
        logger.info(`MusicHandler initialized (SoundCloud+ffmpeg primary, YouTube innertube fallback) | ffmpeg: ${FFMPEG_PATH}${FFMPEG_OK ? '' : ' (PROBE FAILED — awaiting static fallback)'}`);
        // اختبار ذاتي بعد الإقلاع: يثبت أن ffmpeg يستطيع جلب بث SoundCloud فعلياً من هذا السيرفر
        setTimeout(() => this.runSelfTest(), 12_000);
    }
    // ينتظر تنزيل النسخة الثابتة (إن لزم) ثم يحدّث FFMPEG_PATH
    async resolveFfmpeg() {
        if (FFMPEG_OK)
            return;
        await initFfmpeg();
    }
    runSelfTest() {
        void this.resolveFfmpeg().then(() => this.selfTest());
    }
    // --------------------------------------------
    // اختبار ذاتي: SoundCloud → ffmpeg → PCM (بدون Discord)
    // يكشف فوراً إن كان ffmpeg أو شبكة الاستضافة هي المشكلة
    // --------------------------------------------
    selfTest() {
        (async () => {
            const t0 = Date.now();
            const tracks = await scSearchTracks('despacito', 1).catch(() => []);
            if (!tracks.length) {
                logger.warn('🧪 Self-test FAILED: SoundCloud search returned 0 results');
                return;
            }
            const hls = scPickHls(tracks[0].media?.transcodings || []);
            const url = hls ? await scResolveStream(hls.url).catch(() => null) : null;
            if (!url) {
                logger.warn('🧪 Self-test FAILED: SoundCloud resolve returned no stream URL');
                return;
            }
            const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-user_agent', SC_UA, '-i', url, '-vn', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'];
            const proc = (0, child_process_1.spawn)(FFMPEG_PATH, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
            let bytes = 0;
            proc.stdout?.on('data', (c) => { bytes += c.length; });
            proc.on('error', (e) => logger.warn(`🧪 Self-test: ffmpeg spawn error: ${e.message}`));
            const killer = setTimeout(() => { try {
                proc.kill();
            }
            catch { /* تجاهل */ } }, 6000);
            proc.on('close', (code, signal) => {
                clearTimeout(killer);
                const secs = ((Date.now() - t0) / 1000).toFixed(1);
                const kb = Math.round(bytes / 1024);
                if (bytes > 200_000) {
                    logger.info(`🧪 Self-test OK: SoundCloud→ffmpeg produced ${kb}KB PCM in ${secs}s (exit=${code} signal=${signal ?? '-'})`);
                    // الاختبار بالبنية الصحيحة (SoundCloud) هو المرجع — وليس رابط HLS عاماً
                    // قد تحجبه شبكة الاستضافة. إن نجح البث الفعلي فالبنية صالحة.
                    if (!FFMPEG_OK) {
                        FFMPEG_OK = true;
                        logger.info(`✅ ffmpeg confirmed working via real SoundCloud stream: ${FFMPEG_PATH}`);
                    }
                }
                else {
                    logger.warn(`🧪 Self-test FAILED: only ${kb}KB PCM in ${secs}s (exit=${code} signal=${signal ?? '-'})`);
                }
            });
        })().catch((e) => logger.warn(`🧪 Self-test error: ${e.message}`));
    }
    // --------------------------------------------
    // القائمة
    // --------------------------------------------
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                tracks: [],
                currentTrack: null,
                isPlaying: false,
                volume: 100,
                loop: 'none',
            });
        }
        return this.queues.get(guildId);
    }
    // إعدادات الموسيقى من قاعدة البيانات
    async getSettings(guildId) {
        try {
            const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../models')));
            const s = await getGuildSettings(guildId);
            return s?.music || {};
        }
        catch {
            return {};
        }
    }
    // --------------------------------------------
    // البحث
    // --------------------------------------------
    async search(query) {
        // رابط يوتيوب مباشر → تفاصيل الفيديو
        if (/^(https?:\/\/)/i.test(query) && extractVideoId(query)) {
            const t = await this.searchYoutubeUrl(query).catch(() => null);
            if (t)
                return t;
        }
        // رابط SoundCloud مباشر → تفاصيل الأغنية
        if (/soundcloud\.com\//i.test(query)) {
            const t = await this.searchSoundCloudUrl(query).catch(() => null);
            if (t)
                return t;
        }
        // بحث بالاسم عبر SoundCloud أولاً — يعمل من أي IP (بخلاف يوتيوب الذي يحجب سيرفرات الاستضافة)
        try {
            const sc = await this.searchSoundCloud(query);
            if (sc)
                return sc;
        }
        catch (error) {
            logger.warn(`SoundCloud search failed for "${query}": ${error.message}`);
        }
        // بحث احتياطي عبر youtube-sr
        try {
            const video = await youtube_sr_1.YouTube.searchOne(query, 'video').catch(() => null);
            if (video?.url) {
                return {
                    title: video.title || query,
                    url: video.url,
                    duration: Math.floor((video.duration || 0) / 1000),
                    thumbnail: video.thumbnail?.url || '',
                    requestedBy: '',
                    requestedById: '',
                    source: 'youtube',
                };
            }
        }
        catch (error) {
            logger.warn(`youtube-sr search failed, trying innertube fallback: ${error.message}`);
        }
        // بحث احتياطي عبر YouTube Innertube (يعمل حتى لو حجب youtube-sr)
        try {
            return await this.searchInnertube(query);
        }
        catch (error) {
            logger.error(`Innertube search failed for "${query}": ${error.message}`);
            return null;
        }
    }
    // --------------------------------------------
    // بحث SoundCloud (المصدر الأساسي — سريع ويعمل من الاستضافة)
    // --------------------------------------------
    async searchSoundCloud(query) {
        // صيغ بديلة للعبارات العربية القصيرة/العامية (مثل: "جريئه اوي")
        const variants = [query];
        if (/[\u0600-\u06FF]/.test(query))
            variants.push(normalizeArabic(query));
        for (const variant of variants) {
            const results = await scSearchTracks(variant).catch(() => []);
            if (!results.length)
                continue;
            // نفضّل النتيجة المطابقة تماماً إن وُجدت، وإلا الأولى
            const norm = normalizeArabic(variant).toLowerCase();
            const pick = results.find((t) => normalizeArabic(String(t.title || '')).toLowerCase().includes(norm)) ||
                results[0];
            const hls = scPickHls(pick.media.transcodings);
            if (!hls)
                continue;
            if (variant !== query)
                logger.info(`SoundCloud: found via variant "${variant}"`);
            return {
                title: String(pick.title || query),
                url: String(pick.permalink_url || ''),
                duration: Math.floor((pick.duration || 0) / 1000),
                thumbnail: pick.artwork_url || pick.user?.avatar_url || '',
                requestedBy: '',
                requestedById: '',
                source: 'soundcloud',
                scTranscodingUrl: hls.url,
            };
        }
        logger.warn(`SoundCloud: no results for "${query}"`);
        return null;
    }
    // تفاصيل أغنية SoundCloud من رابط مباشر (endpoint resolve)
    async searchSoundCloudUrl(url) {
        const cid = await scGetClientId();
        const r = await fetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${cid}`, { headers: { 'User-Agent': SC_UA }, signal: AbortSignal.timeout(15000) });
        if (!r.ok)
            return null;
        const t = await r.json().catch(() => null);
        if (!t?.media?.transcodings?.length)
            return null;
        const hls = scPickHls(t.media.transcodings);
        if (!hls)
            return null;
        return {
            title: String(t.title || url),
            url: String(t.permalink_url || url),
            duration: Math.floor((t.duration || 0) / 1000),
            thumbnail: t.artwork_url || t.user?.avatar_url || '',
            requestedBy: '',
            requestedById: '',
            source: 'soundcloud',
            scTranscodingUrl: hls.url,
        };
    }
    // تفاصيل فيديو يوتيوب من رابط مباشر (عبر Innertube player — لا يحتاج ytdl)
    async searchYoutubeUrl(url) {
        const videoId = extractVideoId(url);
        if (!videoId)
            return null;
        const d = await innertube('player', {
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'ar', gl: 'EG' } },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
        });
        const vd = d?.videoDetails;
        if (!vd)
            return null;
        return {
            title: vd.title || url,
            url,
            duration: parseInt(vd.lengthSeconds) || 0,
            thumbnail: vd.thumbnail?.thumbnails?.[vd.thumbnail.thumbnails.length - 1]?.url || '',
            requestedBy: '',
            requestedById: '',
            source: 'youtube',
        };
    }
    // --------------------------------------------
    // بحث احتياطي عبر YouTube Innertube API (ANDROID)
    // ملاحظة: يوتيوب قد يرجع صفر نتائج لبعض العبارات القصيرة/العامية،
    // لذلك نجرب عدة صيغ قبل أن نستسلم (اسم + أغنية، تطبيع الحروف العربية)
    // --------------------------------------------
    async searchInnertube(query) {
        const variants = [query];
        if (/[\u0600-\u06FF]/.test(query)) {
            variants.push(`${query} اغنية`, normalizeArabic(query), `${normalizeArabic(query)} اغنية`);
        }
        else {
            variants.push(`${query} song`);
        }
        for (const variant of variants) {
            const video = await this.innertubeSearchOnce(variant).catch(() => null);
            if (video) {
                if (variant !== query) {
                    logger.info(`Innertube: found via variant "${variant}"`);
                }
                const title = video.title?.simpleText ||
                    video.title?.runs?.map((r) => r.text).join('') ||
                    query;
                return {
                    title,
                    url: `https://www.youtube.com/watch?v=${video.videoId}`,
                    duration: parseClockDuration(video.lengthText?.simpleText),
                    thumbnail: video.thumbnail?.thumbnails?.[video.thumbnail.thumbnails.length - 1]?.url || '',
                    requestedBy: '',
                    requestedById: '',
                    source: 'youtube',
                };
            }
        }
        logger.warn(`Innertube: no results for "${query}" (tried ${variants.length} variants)`);
        return null;
    }
    // عملية بحث واحدة — تُرجع أول فيديو أو null
    async innertubeSearchOnce(query) {
        const d = await innertube('search', {
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'ar', gl: 'EG' } },
            query,
        });
        const results = [];
        collectCompactVideos(d, results);
        return results.find((x) => x && x.videoId) || null;
    }
    // --------------------------------------------
    // رابط بث صوتي مباشر عبر Innertube
    // ⚠️ رابط googlevideo يرفض 403 بدون User-Agent صحيح،
    // لذلك نجلب التدفّق بنفسنا ونمرّر الـ Stream لـ discordjs/voice
    // --------------------------------------------
    async innertubeStream(videoId, beginMs = 0) {
        const d = await innertube('player', {
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en', gl: 'US' } },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
        });
        const formats = d?.streamingData?.adaptiveFormats || [];
        const opus = formats.find((f) => (f.mimeType || '').startsWith('audio/webm') && f.url);
        if (!opus?.url || !opus.contentLength)
            return null;
        const total = Number(opus.contentLength) || 0;
        // googlevideo يرفض 403 بدون Range صريح، ويقطع الطلب إذا كبر النطاق
        // → ننزّل البث على شكل مقاطع صغيرة متتالية
        let start = 0;
        if (beginMs > 0 && opus.bitrate) {
            start = Math.floor((Number(opus.bitrate) / 8) * (beginMs / 1000));
            if (total > 0 && start >= total)
                start = 0;
        }
        const stream = new stream_1.PassThrough();
        this.pumpChunks(opus.url, start, total, stream).catch((err) => {
            stream.destroy(err);
        });
        return stream;
    }
    // سحب الملف على شكل مقاطع صغيرة (كل مقطع ~300KB) مع إعادة المحاولة عند 403
    async pumpChunks(baseUrl, start, total, out) {
        const CHUNK = 300000; // أصغر من الحد الذي يقبله googlevideo
        let pos = start;
        while (total === 0 || pos < total) {
            const end = total > 0 ? Math.min(pos + CHUNK - 1, total - 1) : pos + CHUNK - 1;
            const res = await this.fetchChunk(baseUrl, pos, end);
            if (!res || !res.body)
                throw new Error('تعذر جلب مقطع الصوت');
            const reader = res.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (!out.write(Buffer.from(value))) {
                    await new Promise((r) => out.once('drain', r));
                }
            }
            const got = Number(res.headers.get('content-length')) || 0;
            pos += got || (end - pos + 1);
            if (total > 0 && pos >= total)
                break;
            if (!got)
                break; // لا يمكن معرفة الطول → توقف
        }
        out.end();
    }
    // جلب مقطع واحد مع إعادة المحاولة عند 403 (روابط googlevideo قصيرة العمر)
    async fetchChunk(url, start, end) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': YT_UA,
                    Range: `bytes=${start}-${end}`,
                },
            });
            if (res.ok || res.status === 206)
                return res;
            if (res.status !== 403)
                return null;
            // انتظر قليلاً ثم أعد المحاولة
            await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
        }
        return null;
    }
    // إضافة للمسار (مع فحص الحد الأقصى)
    async addTrack(guildId, query, requestedBy, requestedById) {
        const settings = await this.getSettings(guildId);
        const queue = this.getQueue(guildId);
        const maxSize = Number(settings.maxQueueSize) || 50;
        if (queue.tracks.length >= maxSize)
            return null;
        const track = await this.search(query);
        if (!track)
            return null;
        track.requestedBy = requestedBy;
        track.requestedById = requestedById;
        queue.tracks.push(track);
        return track;
    }
    // --------------------------------------------
    // الاتصال الصوتي
    // --------------------------------------------
    connect(guildId, channel) {
        const existing = this.connections.get(guildId);
        if (existing && existing.state.status !== voice_1.VoiceConnectionStatus.Destroyed) {
            if (existing.joinConfig.channelId !== channel.id) {
                existing.rejoin({
                    channelId: channel.id,
                    selfDeaf: true,
                    selfMute: false,
                });
            }
            return existing;
        }
        const connection = (0, voice_1.joinVoiceChannel)({
            channelId: channel.id,
            guildId,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
        });
        connection.on('stateChange', (oldState, newState) => {
            if (oldState.status !== newState.status) {
                logger.info(`Voice connection ${oldState.status} → ${newState.status} (${guildId})`);
            }
            if (newState.status === voice_1.VoiceConnectionStatus.Destroyed) {
                this.cleanup(guildId, false);
            }
            else if (newState.status === voice_1.VoiceConnectionStatus.Disconnected) {
                // محاولة إعادة الاتصال خلال 15 ثانية ثم المغادرة
                Promise.race([
                    (0, voice_1.entersState)(connection, voice_1.VoiceConnectionStatus.Ready, 15_000),
                    (0, voice_1.entersState)(connection, voice_1.VoiceConnectionStatus.Signalling, 15_000),
                ]).catch(() => {
                    logger.warn(`Voice connection lost permanently (${guildId})`);
                    this.cleanup(guildId, true);
                });
            }
        });
        connection.on('error', (err) => logger.error(`Voice connection error (${guildId}): ${err.message}`));
        this.connections.set(guildId, connection);
        return connection;
    }
    getPlayer(guildId) {
        let player = this.players.get(guildId);
        if (player)
            return player;
        player = (0, voice_1.createAudioPlayer)();
        player.on('stateChange', (oldState, newState) => {
            if (oldState.status !== newState.status) {
                logger.info(`Player ${oldState.status} → ${newState.status} (${guildId}, played=${oldState.resource?.playbackDuration ?? 0}ms)`);
            }
            if (newState.status === voice_1.AudioPlayerStatus.Idle && oldState.status !== voice_1.AudioPlayerStatus.Idle) {
                // نحفظ المدة المُشغَّلة فعلياً قبل أن يفقد المشغّل الـ resource
                this.lastPlayMs.set(guildId, oldState.resource?.playbackDuration ?? 0);
                this.onTrackEnd(guildId);
            }
        });
        player.on('error', (err) => {
            logger.error(`Audio player error (${guildId}): ${err.message}`);
            this.onTrackEnd(guildId);
        });
        this.players.set(guildId, player);
        return player;
    }
    // تنظيف الاتصال والمشغّل
    cleanup(guildId, destroyConnection = true) {
        const connection = this.connections.get(guildId);
        if (connection) {
            this.connections.delete(guildId);
            if (destroyConnection) {
                try {
                    connection.destroy();
                }
                catch { /* تجاهل */ }
            }
        }
        this.players.delete(guildId);
        this.manualStops.delete(guildId);
        this.seekOffsets.delete(guildId);
        this.lastPlayMs.delete(guildId);
        this.killFfmpeg(guildId);
    }
    // --------------------------------------------
    // بدء تشغيل الأغنية الحالية
    // --------------------------------------------
    async startCurrent(guildId, beginMs = 0) {
        const queue = this.getQueue(guildId);
        const track = queue.currentTrack;
        if (!track)
            return false;
        const connection = this.connections.get(guildId);
        const player = this.getPlayer(guildId);
        if (!connection)
            return false;
        // ---- المصدر الأساسي: SoundCloud عبر ffmpeg (يعمل من الاستضافة) ----
        if (track.source === 'soundcloud' && track.scTranscodingUrl) {
            try {
                const ok = await this.startSoundcloud(guildId, track, beginMs);
                if (ok)
                    return true;
                logger.warn(`SoundCloud stream unavailable for "${track.title}", falling back to YouTube`);
            }
            catch (err) {
                logger.error(`SoundCloud failed for "${track.title}": ${err.message}`);
            }
            // لا نستسلم — نجرب يوتيوب أسفله
        }
        // ---- احتياطي: يوتيوب عبر Innertube مباشرة (ytdl معطّل: يفشل دائماً ويبطئ 6 ثوانٍ) ----
        try {
            const videoId = extractVideoId(track.url);
            const stream = videoId ? await this.innertubeStream(videoId, beginMs) : null;
            if (!stream)
                throw new Error('لا يوجد رابط بث (يوتيوب يحجب هذا العنوان)');
            const resource = (0, voice_1.createAudioResource)(stream, {
                inputType: voice_1.StreamType.WebmOpus,
                inlineVolume: true,
            });
            if (resource.volume) {
                resource.volume.setVolume(Math.max(0, Math.min(4, queue.volume / 100)));
            }
            this.killFfmpeg(guildId); // أي ffmpeg سابق لا معنى له الآن
            connection.subscribe(player);
            player.play(resource);
            this.seekOffsets.set(guildId, beginMs);
            queue.isPlaying = true;
            logger.info(`YouTube (innertube) stream started for "${track.title}"`);
            return true;
        }
        catch (fallbackError) {
            logger.error(`Failed to start "${track.title}" (${guildId}): ${fallbackError.message}`);
            // آخر محاولة: يوتيوب محجوب من الاستضافة → ابحث بنفس العنوان في SoundCloud
            if (track.source !== 'soundcloud') {
                const scTrack = await this.searchSoundCloud(track.title).catch(() => null);
                if (scTrack) {
                    logger.info(`YouTube blocked — retrying "${track.title}" via SoundCloud`);
                    queue.currentTrack = {
                        ...scTrack,
                        requestedBy: track.requestedBy,
                        requestedById: track.requestedById,
                    };
                    try {
                        if (await this.startSoundcloud(guildId, queue.currentTrack, beginMs))
                            return true;
                    }
                    catch (e2) {
                        logger.error(`SoundCloud retry failed: ${e2.message}`);
                    }
                }
            }
            queue.isPlaying = false;
            // تخطي تلقائي للأغنية التالية عند فشل المصدر
            const next = queue.tracks.shift() ?? null;
            if (next) {
                queue.currentTrack = next;
                await this.startCurrent(guildId).catch(() => false);
            }
            else {
                queue.currentTrack = null;
                this.cleanup(guildId, true);
            }
            return false;
        }
    }
    // --------------------------------------------
    // تشغيل SoundCloud: رابط HLS → ffmpeg → PCM خام (48k stereo)
    // --------------------------------------------
    async startSoundcloud(guildId, track, beginMs) {
        const queue = this.getQueue(guildId);
        const connection = this.connections.get(guildId);
        const player = this.getPlayer(guildId);
        if (!connection)
            return false;
        await this.resolveFfmpeg(); // انتظر تنزيل النسخة الثابتة إن كان المثبّت معطوباً
        // 1) أوقف أي ffmpeg سابق
        this.killFfmpeg(guildId);
        // 2) شغّل ffmpeg وانتظر أول بايت PCM قبل الالتزام بالمشغّل:
        //    حزم ffmpeg المثبّتة تنهار أحياناً بـ SIGSEGV عند فك ترميز HLS (ظهر متقطعاً).
        //    إن لم تصل بيانات خلال المهلة → نعيد المحاولة برابط/عملية جديدة حتى ننجح.
        const MAX_TRIES = 3;
        for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
            // رابط جديد لكل محاولة: روابط SoundCloud الموقّعة قصيرة الصلاحية وقد تُفقد
            let url = await scResolveStream(track.scTranscodingUrl).catch(() => null);
            if (!url) {
                scClientId = null; // أجبر تحديث المفتاح
                url = await scResolveStream(track.scTranscodingUrl).catch(() => null);
            }
            if (!url)
                throw new Error('تعذر جلب رابط البث من SoundCloud');
            const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-user_agent', SC_UA];
            if (beginMs > 0)
                args.push('-ss', String(Math.floor(beginMs / 1000)));
            args.push('-i', url, '-vn', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
            const proc = (0, child_process_1.spawn)(FFMPEG_PATH, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
            let stderrBuf = '';
            proc.stderr?.on('data', (c) => {
                stderrBuf = (stderrBuf + c.toString()).slice(-300);
            });
            // انتظر أول بايت PCM (أو الفشل/الإنهاء) — ناشر عبر PassThrough لتجنّب ضياع البيانات
            const ready = await new Promise((resolve) => {
                let settled = false;
                const settle = (v) => { if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(v);
                } };
                const timer = setTimeout(() => settle('dead'), 10_000);
                proc.once('spawn', () => {
                    proc.stdout?.once('data', () => settle('data'));
                });
                proc.once('error', () => settle('dead'));
                proc.once('close', () => settle('dead'));
            });
            if (ready === 'data') {
                // نجاح — مرّر الـ PCM للمشغّل الآن
                this.ffprocs.set(guildId, proc);
                const spawnMs = Date.now();
                proc.on('close', (code, signal) => {
                    this.ffprocs.delete(guildId);
                    logger.info(`ffmpeg ended (${guildId}): exit=${code} signal=${signal ?? '-'}`);
                });
                const out = new stream_1.PassThrough();
                proc.stdout.pipe(out);
                const resource = (0, voice_1.createAudioResource)(out, { inputType: voice_1.StreamType.Raw, inlineVolume: true });
                if (resource.volume) {
                    resource.volume.setVolume(Math.max(0, Math.min(4, queue.volume / 100)));
                }
                connection.subscribe(player);
                player.play(resource);
                this.seekOffsets.set(guildId, beginMs);
                queue.isPlaying = true;
                logger.info(`SoundCloud stream started for "${track.title}" (seek=${beginMs}ms, attempt=${attempt}, ttfb=${Date.now() - spawnMs}ms)`);
                return true;
            }
            // فشل (SIGSEGV أو مهلة) — أوقف العملية وأعد المحاولة
            logger.warn(`ffmpeg produced no audio (${guildId}) attempt ${attempt}/${MAX_TRIES} | ${stderrBuf.slice(0, 160)}`);
            try {
                proc.kill();
            }
            catch { /* تجاهل */ }
        }
        throw new Error(`تعذّر تشغيل ffmpeg بعد ${MAX_TRIES} محاولات`);
    }
    // إيقاف ffmpeg النشط لهذا السيرفر (إن وُجد)
    killFfmpeg(guildId) {
        const proc = this.ffprocs.get(guildId);
        if (proc) {
            try {
                proc.kill();
            }
            catch {
                /* تجاهل */
            }
            this.ffprocs.delete(guildId);
        }
    }
    // انتهاء الأغنية (طبيعياً أو عبر stop())
    onTrackEnd(guildId) {
        const manual = this.manualStops.get(guildId) || 0;
        if (manual > 0) {
            this.manualStops.set(guildId, manual - 1);
            return; // التوقف اليدوي يتولاه المتوقف (skip/stop)
        }
        const queue = this.getQueue(guildId);
        // هل انتهت مبكراً جداً؟ (فشل بث — مثلاً ffmpeg أو يوتيوب رفضا المصدر)
        const durMs = (queue.currentTrack?.duration || 0) * 1000;
        const played = this.lastPlayMs.get(guildId) || 0;
        const earlyFail = durMs > 10_000 && played < 4_000;
        // تكرار الأغنية الحالية — لكن لا نكرّرها إن فشلت فوراً (حلقة لا نهائية)
        if (queue.loop === 'track' && queue.currentTrack && !earlyFail) {
            this.startCurrent(guildId).catch(() => { });
            return;
        }
        this.advance(guildId, earlyFail);
    }
    // الانتقال للأغنية التالية
    advance(guildId, earlyFail = false) {
        const queue = this.getQueue(guildId);
        const prev = queue.currentTrack;
        // تكرار القائمة: نعيد الأغنية المنتهية للنهاية (إلا إن فشلت فوراً)
        if (queue.loop === 'queue' && prev && !earlyFail)
            queue.tracks.push(prev);
        const next = queue.tracks.shift() ?? null;
        queue.currentTrack = next;
        const player = this.players.get(guildId);
        if (player && player.state.status !== voice_1.AudioPlayerStatus.Idle) {
            this.manualStops.set(guildId, (this.manualStops.get(guildId) || 0) + 1);
            player.stop();
        }
        if (next) {
            queue.isPlaying = true;
            this.startCurrent(guildId).catch(() => { });
        }
        else {
            queue.isPlaying = false;
            queue.currentTrack = null;
            this.cleanup(guildId, true);
        }
    }
    // --------------------------------------------
    // التشغيل
    // --------------------------------------------
    async play(member, query, textChannelId) {
        const guildId = member.guild.id;
        const channel = member.voice.channel;
        if (!channel) {
            return { success: false, message: '❌ يجب أن تكون في قناة صوتية أولاً!' };
        }
        // إعدادات السيرفر
        const settings = await this.getSettings(guildId);
        if (settings.enabled === false) {
            return { success: false, message: '❌ نظام الموسيقى **معطّل** في هذا السيرفر (من لوحة الإعدادات)' };
        }
        if (Array.isArray(settings.restrictToChannels) && settings.restrictToChannels.length > 0) {
            if (textChannelId && !settings.restrictToChannels.includes(textChannelId)) {
                return { success: false, message: '❌ الموسيقى مسموحة فقط في القنوات المحددة في الإعدادات 🔒' };
            }
        }
        if (settings.allowDJ && settings.djRoleId) {
            const isDJ = member.roles.cache.has(settings.djRoleId);
            const isAdmin = member.permissions.has('ManageGuild');
            if (!isDJ && !isAdmin) {
                return { success: false, message: '🎧 وضع DJ مفعّل — يتطلب رول DJ أو صلاحية إدارة السيرفر' };
            }
        }
        // صلاحيات البوت في القناة الصوتية
        const botMember = member.guild.members.me;
        const botPerms = channel.permissionsFor(botMember);
        if (botPerms && (!botPerms.has('Connect') || !botPerms.has('Speak'))) {
            return { success: false, message: '❌ لا أملك صلاحية الدخول/التحدث في القناة الصوتية!' };
        }
        const track = await this.addTrack(guildId, query, member.user.username, member.user.id);
        if (!track) {
            const queue = this.getQueue(guildId);
            return {
                success: false,
                message: queue.tracks.length >= (Number(settings.maxQueueSize) || 50)
                    ? `❌ القائمة ممتلئة (الحد: ${settings.maxQueueSize || 50})!`
                    : '❌ لم أتمكن من العثور على الأغنية! (جرّب رابط يوتيوب مباشر)',
            };
        }
        const queue = this.getQueue(guildId);
        // هناك تشغيل فعّال → الأغنية أصبحت في القائمة فقط
        if (queue.isPlaying && queue.currentTrack) {
            return { success: true, track, message: `✅ **أضيفت للقائمة (#${queue.tracks.length}):** ${track.title}` };
        }
        // بدء التشغيل
        queue.currentTrack = queue.tracks.shift() ?? track;
        if (typeof settings.defaultVolume === 'number') {
            queue.volume = Math.max(0, Math.min(200, settings.defaultVolume));
        }
        try {
            this.connect(guildId, channel);
            const connection = this.connections.get(guildId);
            await (0, voice_1.entersState)(connection, voice_1.VoiceConnectionStatus.Ready, 20_000);
        }
        catch {
            queue.isPlaying = false;
            queue.currentTrack = null;
            this.cleanup(guildId, true);
            return { success: false, message: '❌ تعذر الاتصال بالقناة الصوتية — تأكد من صلاحياتي وحاول مجدداً' };
        }
        const started = await this.startCurrent(guildId);
        if (!started) {
            return { success: false, message: `❌ تعذر تشغيل **${track.title}** — جرّب أغنية أخرى` };
        }
        return { success: true, track, message: `🎵 **تشغيل الآن:** ${track.title}` };
    }
    // --------------------------------------------
    // التحكم
    // --------------------------------------------
    skip(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.currentTrack && queue.tracks.length === 0)
            return false;
        this.advance(guildId);
        return true;
    }
    stop(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || (!queue.currentTrack && queue.tracks.length === 0))
            return false;
        queue.tracks = [];
        queue.currentTrack = null;
        queue.isPlaying = false;
        const player = this.players.get(guildId);
        if (player && player.state.status !== voice_1.AudioPlayerStatus.Idle) {
            this.manualStops.set(guildId, (this.manualStops.get(guildId) || 0) + 1);
            player.stop();
        }
        this.cleanup(guildId, true);
        return true;
    }
    pause(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.isPlaying)
            return false;
        const player = this.players.get(guildId);
        if (!player)
            return false;
        const paused = player.pause();
        if (paused)
            queue.isPlaying = false;
        return paused;
    }
    resume(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.currentTrack || queue.isPlaying)
            return false;
        const player = this.players.get(guildId);
        if (!player)
            return false;
        const resumed = player.unpause();
        if (resumed)
            queue.isPlaying = true;
        return resumed;
    }
    // الانتقال لوقت محدد (إعادة بناء البث مع begin)
    async seek(guildId, seconds) {
        const queue = this.getQueue(guildId);
        if (!queue.currentTrack || !this.connections.has(guildId))
            return false;
        return this.startCurrent(guildId, Math.max(0, seconds) * 1000);
    }
    // ⏱️ الموضع الحالي بالثواني = نقطة البداية + زمن الصوت المنplayed فعلياً
    // (playbackDuration لا يزيد أثناء الإيقاف المؤقت ⇒ دقيق بما يكفي)
    getPosition(guildId) {
        const player = this.players.get(guildId);
        if (!player)
            return 0;
        const st = player.state;
        if (st.status !== voice_1.AudioPlayerStatus.Playing && st.status !== voice_1.AudioPlayerStatus.Paused)
            return 0;
        const offset = this.seekOffsets.get(guildId) || 0;
        return Math.floor((offset + st.resource.playbackDuration) / 1000);
    }
    // ⏩ تقديم / ⏪ إرجاع بعدد ثوانٍ (افتراضي 10)
    async forward(guildId, seconds = 10) {
        const target = this.getPosition(guildId) + Math.max(1, seconds);
        return (await this.seek(guildId, target)) ? target : null;
    }
    async back(guildId, seconds = 10) {
        const target = Math.max(0, this.getPosition(guildId) - Math.max(1, seconds));
        return (await this.seek(guildId, target)) ? target : null;
    }
    setVolume(guildId, volume) {
        const queue = this.getQueue(guildId);
        queue.volume = Math.max(0, Math.min(200, volume));
        const player = this.players.get(guildId);
        const status = player?.state.status;
        const resource = status === voice_1.AudioPlayerStatus.Playing || status === voice_1.AudioPlayerStatus.Paused
            ? player.state.resource
            : null;
        if (resource?.volume) {
            resource.volume.setVolume(Math.max(0, Math.min(4, queue.volume / 100)));
        }
        return true;
    }
    setLoop(guildId, mode) {
        const queue = this.getQueue(guildId);
        queue.loop = mode;
        return true;
    }
    shuffle(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.tracks.length < 2)
            return false;
        for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
        }
        return true;
    }
    removeTrack(guildId, position) {
        const queue = this.getQueue(guildId);
        if (position < 1 || position > queue.tracks.length)
            return null;
        return queue.tracks.splice(position - 1, 1)[0] ?? null;
    }
    getQueueInfo(guildId) {
        return this.queues.get(guildId) ?? null;
    }
    getCurrentTrack(guildId) {
        return this.queues.get(guildId)?.currentTrack ?? null;
    }
    isConnected(guildId) {
        const connection = this.connections.get(guildId) ?? (0, voice_1.getVoiceConnection)(guildId);
        return !!connection && connection.state.status === voice_1.VoiceConnectionStatus.Ready;
    }
    leave(guildId) {
        const queue = this.queues.get(guildId);
        if (queue) {
            queue.tracks = [];
            queue.currentTrack = null;
            queue.isPlaying = false;
        }
        const player = this.players.get(guildId);
        if (player && player.state.status !== voice_1.AudioPlayerStatus.Idle) {
            this.manualStops.set(guildId, (this.manualStops.get(guildId) || 0) + 1);
            player.stop();
        }
        this.cleanup(guildId, true);
        this.queues.delete(guildId);
        logger.info(`Left voice channel in ${guildId}`);
    }
}
exports.MusicHandler = MusicHandler;
const musicHandler = (client) => new MusicHandler(client);
exports.musicHandler = musicHandler;
//# sourceMappingURL=MusicHandler.js.map