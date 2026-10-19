"use strict";
// ============================================
// Liberty City Bot - Music Handler
// نظام الموسيقى مع دعم يوتيوب وقوائم التشغيل
// ملاحظة: يتطلب تثبيت @discordjs/voice و @discordjs/opus للعمل الصوتي الفعلي
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.musicHandler = exports.MusicHandler = void 0;
const ytdl_core_1 = __importDefault(require("@distube/ytdl-core"));
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('MusicHandler');
class MusicHandler {
    client;
    queues = new Map();
    constructor(client) {
        this.client = client;
        logger.info('MusicHandler initialized (voice features require @discordjs/voice)');
    }
    // الحصول على كيو السيرفر أو إنشاؤه
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
    // البحث عن أغنية في يوتيوب
    async search(query) {
        try {
            let videoInfo;
            const isUrl = ytdl_core_1.default.validateURL(query);
            if (isUrl) {
                videoInfo = await ytdl_core_1.default.getInfo(query);
            }
            else {
                // استخدام البحث عبر getInfo مع query للبحث
                videoInfo = await ytdl_core_1.default.getInfo(query);
            }
            const video = videoInfo.videoDetails;
            return {
                title: video.title,
                url: video.video_url,
                duration: parseInt(video.lengthSeconds),
                thumbnail: video.thumbnails[video.thumbnails.length - 1]?.url || '',
                requestedBy: '',
                requestedById: '',
            };
        }
        catch (error) {
            logger.error('YouTube search error:', error);
            return null;
        }
    }
    // إضافة للمسار
    async addTrack(guildId, query, requestedBy, requestedById) {
        const track = await this.search(query);
        if (!track)
            return null;
        track.requestedBy = requestedBy;
        track.requestedById = requestedById;
        const queue = this.getQueue(guildId);
        queue.tracks.push(track);
        return track;
    }
    // تشغيل (Placeholder - يتطلب @discordjs/voice)
    async play(member, query) {
        const guildId = member.guild.id;
        if (!member.voice.channel) {
            return { success: false, message: '❌ يجب أن تكون في قناة صوتية أولاً!' };
        }
        const track = await this.addTrack(guildId, query, member.user.username, member.user.id);
        if (!track) {
            return { success: false, message: '❌ لم أتمكن من العثور على الأغنية!' };
        }
        const queue = this.getQueue(guildId);
        if (!queue.isPlaying) {
            // TODO: Implement actual voice playback with @discordjs/voice
            queue.isPlaying = true;
            queue.currentTrack = track;
            return { success: true, track, message: `🎵 **تشغيل الآن:** ${track.title}\n⚠️ ميزة التشغيل الصوتي تتطلب تثبيت \`@discordjs/voice\`` };
        }
        else {
            const position = queue.tracks.length;
            return { success: true, track, message: `✅ **أضيفت للقائمة (#${position}):** ${track.title}` };
        }
    }
    // تخطي
    skip(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.isPlaying && queue.tracks.length === 0)
            return false;
        // TODO: Implement actual skip with voice connection
        queue.currentTrack = queue.tracks.shift() ?? null;
        return true;
    }
    // إيقاف
    stop(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.isPlaying && queue.tracks.length === 0)
            return false;
        queue.tracks = [];
        queue.currentTrack = null;
        queue.isPlaying = false;
        return true;
    }
    // إيقاف مؤقت / استئناف
    pause(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.isPlaying)
            return false;
        queue.isPlaying = false;
        // TODO: Implement actual pause with voice connection
        return true;
    }
    resume(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue.currentTrack || queue.isPlaying)
            return false;
        queue.isPlaying = true;
        // TODO: Implement actual resume with voice connection
        return true;
    }
    // تقديم / تأخير (Seek)
    async seek(guildId, seconds) {
        // TODO: Implement with voice connection
        return false;
    }
    // التحكم في الصوت
    setVolume(guildId, volume) {
        const queue = this.getQueue(guildId);
        queue.volume = Math.max(0, Math.min(200, volume));
        // TODO: Apply to voice connection
        return true;
    }
    // تكرار
    setLoop(guildId, mode) {
        const queue = this.getQueue(guildId);
        queue.loop = mode;
        return true;
    }
    // خلط القائمة
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
    // إزالة من القائمة
    removeTrack(guildId, position) {
        const queue = this.getQueue(guildId);
        if (position < 1 || position > queue.tracks.length)
            return null;
        return queue.tracks.splice(position - 1, 1)[0] ?? null;
    }
    // الحصول على القائمة
    getQueueInfo(guildId) {
        return this.queues.get(guildId) ?? null;
    }
    // الأغنية الحالية
    getCurrentTrack(guildId) {
        const queue = this.getQueue(guildId);
        return queue.currentTrack ?? null;
    }
    // التحقق من وجود اتصال
    isConnected(guildId) {
        return false; // Placeholder
    }
    // مغادرة القناة الصوتية
    leave(guildId) {
        this.queues.delete(guildId);
        logger.info(`Left voice channel in ${guildId}`);
    }
}
exports.MusicHandler = MusicHandler;
const musicHandler = (client) => new MusicHandler(client);
exports.musicHandler = musicHandler;
//# sourceMappingURL=MusicHandler.js.map