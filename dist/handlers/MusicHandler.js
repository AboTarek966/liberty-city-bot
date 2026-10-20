"use strict";
// ============================================
// Liberty City Bot - Music Handler
// نظام موسيقى حقيقي: @discordjs/voice + ytdl (webm/opus — بدون ffmpeg)
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.musicHandler = exports.MusicHandler = void 0;
const voice_1 = require("@discordjs/voice");
const ytdl_core_1 = __importDefault(require("@distube/ytdl-core"));
const youtube_sr_1 = require("youtube-sr");
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
// معرّف الفيديو من أي صيغة رابط يوتيوب
function extractVideoId(url) {
    const m = url.match(/[?&]v=([\w-]{11})/) ||
        url.match(/youtu\.be\/([\w-]{11})/) ||
        url.match(/shorts\/([\w-]{11})/) ||
        url.match(/embed\/([\w-]{11})/);
    return m ? m[1] : null;
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
    constructor(client) {
        this.client = client;
        logger.info('MusicHandler initialized (real voice playback via @discordjs/voice)');
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
        try {
            // رابط يوتيوب مباشر
            if (ytdl_core_1.default.validateURL(query)) {
                const info = await ytdl_core_1.default.getInfo(query);
                const v = info.videoDetails;
                return {
                    title: v.title,
                    url: v.video_url,
                    duration: parseInt(v.lengthSeconds) || 0,
                    thumbnail: v.thumbnails?.[v.thumbnails.length - 1]?.url || '',
                    requestedBy: '',
                    requestedById: '',
                };
            }
        }
        catch (error) {
            logger.error(`Direct URL lookup failed: ${error.message}`);
            // لا نوقف البحث — قد ينجح البحث بالاسم حتى لو فشل الوصول المباشر
        }
        // بحث نصي أولاً عبر youtube-sr
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
    // بحث احتياطي عبر YouTube Innertube API (ANDOID)
    // --------------------------------------------
    async searchInnertube(query) {
        const d = await innertube('search', {
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'ar', gl: 'EG' } },
            query,
        });
        const results = [];
        collectCompactVideos(d, results);
        const v = results.find((x) => x && x.videoId);
        if (!v) {
            logger.warn(`Innertube: no results for "${query}"`);
            return null;
        }
        const title = v.title?.simpleText || v.title?.runs?.map((r) => r.text).join('') || query;
        return {
            title,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            duration: parseClockDuration(v.lengthText?.simpleText),
            thumbnail: v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url || '',
            requestedBy: '',
            requestedById: '',
        };
    }
    // --------------------------------------------
    // رابط بث صوتي مباشر عبر Innertube (احتياطي عندما يفشل ytdl)
    // --------------------------------------------
    async innertubeStreamUrl(videoId) {
        const d = await innertube('player', {
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'en', gl: 'US' } },
            videoId,
            contentCheckOk: true,
            racyCheckOk: true,
        });
        const formats = d?.streamingData?.adaptiveFormats || [];
        const opus = formats.find((f) => (f.mimeType || '').startsWith('audio/webm') && f.url);
        return opus?.url || null;
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
            if (newState.status === voice_1.AudioPlayerStatus.Idle && oldState.status !== voice_1.AudioPlayerStatus.Idle) {
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
        try {
            const info = await ytdl_core_1.default.getInfo(track.url);
            // ن prefer صيغة webm/opus حتى لا نحتاج ffmpeg
            const format = ytdl_core_1.default.chooseFormat(info.formats, {
                quality: 'highestaudio',
                filter: (f) => f.container === 'webm' && f.hasAudio && !f.hasVideo,
            }) ||
                ytdl_core_1.default.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audio' });
            const stream = ytdl_core_1.default.downloadFromInfo(info, {
                format,
                highWaterMark: 1 << 22,
                ...(beginMs > 0 ? { begin: beginMs } : {}),
            });
            const resource = (0, voice_1.createAudioResource)(stream, {
                inputType: voice_1.StreamType.WebmOpus,
                inlineVolume: true,
            });
            if (resource.volume) {
                resource.volume.setVolume(Math.max(0, Math.min(4, queue.volume / 100)));
            }
            connection.subscribe(player);
            player.play(resource);
            this.seekOffsets.set(guildId, beginMs);
            queue.isPlaying = true;
            return true;
        }
        catch (ytdlError) {
            // فشل ytdl (غالباً حجب) → محاولة احتياطية عبر Innertube
            logger.warn(`ytdl failed for "${track.title}", trying innertube: ${ytdlError.message}`);
            try {
                const videoId = extractVideoId(track.url);
                const directUrl = videoId ? await this.innertubeStreamUrl(videoId) : null;
                if (!directUrl)
                    throw new Error('لا يوجد رابط بث احتياطي');
                const resource = (0, voice_1.createAudioResource)(directUrl, {
                    inputType: voice_1.StreamType.WebmOpus,
                    inlineVolume: true,
                });
                if (resource.volume) {
                    resource.volume.setVolume(Math.max(0, Math.min(4, queue.volume / 100)));
                }
                connection.subscribe(player);
                player.play(resource);
                this.seekOffsets.set(guildId, beginMs);
                queue.isPlaying = true;
                logger.info(`Innertube fallback stream started for "${track.title}"`);
                return true;
            }
            catch (fallbackError) {
                logger.error(`Failed to start "${track.title}" (${guildId}): ${ytdlError.message} | fallback: ${fallbackError.message}`);
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
    }
    // انتهاء الأغنية (طبيعياً أو عبر stop())
    onTrackEnd(guildId) {
        const manual = this.manualStops.get(guildId) || 0;
        if (manual > 0) {
            this.manualStops.set(guildId, manual - 1);
            return; // التوقف اليدوي يتولاه المتوقف (skip/stop)
        }
        const queue = this.getQueue(guildId);
        // تكرار الأغنية الحالية
        if (queue.loop === 'track' && queue.currentTrack) {
            this.startCurrent(guildId).catch(() => { });
            return;
        }
        this.advance(guildId);
    }
    // الانتقال للأغنية التالية
    advance(guildId) {
        const queue = this.getQueue(guildId);
        const prev = queue.currentTrack;
        // تكرار القائمة: نعيد الأغنية المنتهية للنهاية
        if (queue.loop === 'queue' && prev)
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
            return { success: false, message: `❌ تعذر تشغيل **${track.title}** — يوتيوب يرفض المصدر الآن، جرّب أغنية أخرى` };
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