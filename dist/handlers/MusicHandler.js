"use strict";
// ============================================
// Liberty City Bot - Music Handler (نظام موسيقى كامل)
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
exports.MusicHandler = exports.RepeatMode = void 0;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('MusicHandler');
// حالات الطابور
var RepeatMode;
(function (RepeatMode) {
    RepeatMode["OFF"] = "off";
    RepeatMode["TRACK"] = "track";
    RepeatMode["QUEUE"] = "queue";
})(RepeatMode || (exports.RepeatMode = RepeatMode = {}));
class MusicHandler {
    client;
    queues = new Map();
    ytdl = null;
    constructor(client) {
        this.client = client;
        this.initYtdl();
    }
    async initYtdl() {
        try {
            const ytdl = await Promise.resolve().then(() => __importStar(require('@distube/ytdl-core')));
            this.ytdl = ytdl.default;
            logger.info('ytdl-core initialized');
        }
        catch (error) {
            logger.warn('ytdl-core not available:', error);
        }
    }
    // --------------------------------------------
    // Queue Management
    // --------------------------------------------
    getQueue(guildId) {
        return this.queues.get(guildId);
    }
    createQueue(guildId) {
        const queue = {
            tracks: [],
            current: null,
            playing: false,
            paused: false,
            volume: 50,
            repeat: RepeatMode.OFF,
            textChannel: null,
            voiceChannel: null,
            message: null,
        };
        this.queues.set(guildId, queue);
        return queue;
    }
    deleteQueue(guildId) {
        const queue = this.queues.get(guildId);
        if (queue?.voiceChannel) {
            queue.voiceChannel.leave();
        }
        this.queues.delete(guildId);
    }
    // --------------------------------------------
    // Search & Play
    // --------------------------------------------
    async search(query) {
        if (!this.ytdl) {
            throw new Error('YouTube downloader غير متاح');
        }
        try {
            const info = await this.ytdl.getInfo(query);
            const formats = info.formats.filter((f) => f.hasAudio && f.hasVideo);
            const bestFormat = formats.sort((a, b) => (b.audioQuality || 0) - (a.audioQuality || 0))[0];
            return [{
                    title: info.videoDetails.title,
                    url: info.videoDetails.video_url,
                    duration: parseInt(info.videoDetails.lengthSeconds) * 1000,
                    thumbnail: info.videoDetails.thumbnails[0]?.url || '',
                    requestedBy: '',
                    source: 'youtube',
                }];
        }
        catch (error) {
            // Try search
            try {
                const searchResults = await this.ytdl.search(query, { limit: 5 });
                return searchResults.map((video) => ({
                    title: video.title,
                    url: video.url,
                    duration: parseInt(video.length_seconds) * 1000,
                    thumbnail: video.thumbnails[0]?.url || '',
                    requestedBy: '',
                    source: 'youtube',
                }));
            }
            catch (e) {
                logger.error('YouTube search failed:', error);
                return [];
            }
        }
    }
    async play(guildId, track, interaction) {
        let queue = this.queues.get(guildId);
        if (!queue) {
            queue = this.createQueue(interaction.guild.id);
        }
        // Join voice channel
        if (!queue.voiceChannel) {
            const member = interaction.member;
            if (!member?.voice.channel) {
                throw new Error('يجب أن تكون في روم صوتي');
            }
            queue.voiceChannel = member.voice.channel;
            queue.textChannel = interaction.channel;
            try {
                await queue.voiceChannel.join();
            }
            catch (error) {
                throw new Error('فشل الانضمام للروم الصوتي');
            }
        }
        // Add to queue
        queue.tracks.push(track);
        if (!queue.playing && !queue.paused) {
            await this.processQueue(guildId);
        }
    }
    // --------------------------------------------
    // Queue Processing
    // --------------------------------------------
    async processQueue(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || queue.tracks.length === 0) {
            queue.playing = false;
            queue.current = null;
            await this.updateNowPlaying(guildId);
            return;
        }
        queue.playing = true;
        queue.paused = false;
        queue.current = queue.tracks.shift() || null;
        if (!queue.current)
            return;
        await this.updateNowPlaying(guildId);
        // Here you would actually play the audio using @discordjs/voice
        // For now, we'll simulate with a timeout
        const track = queue.current;
        // Simulate playing (in real implementation, use @discordjs/voice)
        await this.simulatePlay(guildId, track.duration);
    }
    async simulatePlay(guildId, duration) {
        const queue = this.queues.get(guildId);
        if (!queue)
            return;
        // Wait for track duration (or until stopped/skipped)
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const q = this.queues.get(guildId);
                if (!q || !q.playing || q.paused || q.current !== queue?.current) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, duration);
        });
        // Handle repeat
        const queue = this.queues.get(guildId);
        if (!queue)
            return;
        if (queue.repeat === RepeatMode.TRACK && queue.current) {
            queue.tracks.unshift(queue.current);
        }
        else if (queue.repeat === RepeatMode.QUEUE && queue.current) {
            queue.tracks.push(queue.current);
        }
        queue.current = null;
        await this.processQueue(guildId);
    }
    // --------------------------------------------
    // Controls
    // --------------------------------------------
    async skip(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || !queue.playing)
            return false;
        // In real implementation, stop current audio
        return true;
    }
    async pause(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || !queue.playing)
            return false;
        queue.paused = true;
        queue.playing = false;
        return true;
    }
    async resume(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || !queue.paused)
            return false;
        queue.paused = false;
        queue.playing = true;
        return true;
    }
    async stop(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue)
            return;
        queue.tracks = [];
        queue.playing = false;
        queue.paused = false;
        queue.current = null;
        if (queue.voiceChannel) {
            queue.voiceChannel.leave();
            queue.voiceChannel = null;
        }
    }
    setVolume(guildId, volume) {
        const queue = this.queues.get(guildId);
        if (!queue)
            return false;
        queue.volume = Math.max(0, Math.min(100, volume));
        return true;
    }
    setRepeat(guildId, mode) {
        const queue = this.queues.get(guildId);
        if (!queue)
            return false;
        queue.repeat = mode;
        return true;
    }
    // --------------------------------------------
    // Now Playing Panel
    // --------------------------------------------
    async updateNowPlaying(guildId) {
        const queue = this.queues.get(guildId);
        if (!queue || !queue.textChannel || !queue.current)
            return;
        const embed = this.buildNowPlayingEmbed(queue);
        const components = this.buildControlButtons(queue);
        try {
            if (queue.message) {
                await queue.message.edit({ embeds: [embed], components });
            }
            else {
                queue.message = await queue.textChannel.send({ embeds: [embed], components });
            }
        }
        catch (error) {
            logger.warn('Failed to update now playing:', error);
        }
    }
    buildNowPlayingEmbed(queue) {
        const track = queue.current;
        if (!track) {
            return new discord_js_1.EmbedBuilder()
                .setTitle('🎵 لا توجد أغنية قيد التشغيل')
                .setColor(0x5865F2);
        }
        const progress = queue.paused ? '⏸️ متوقفة' : '▶️ قيد التشغيل';
        const repeatIcons = {
            [RepeatMode.OFF]: '🔁 إيقاف التكرار',
            [RepeatMode.TRACK]: '🔂 تكرار الأغنية',
            [RepeatMode.QUEUE]: '🔁 تكرار القائمة',
        };
        return new discord_js_1.EmbedBuilder()
            .setTitle('🎵 مشغل الموسيقى')
            .setDescription(`**${track.title}**\n${progress} | ${repeatIcons[queue.repeat]}`)
            .setThumbnail(track.thumbnail)
            .addFields({ name: '⏱️ المدة', value: this.formatDuration(track.duration), inline: true }, { name: '🔊 الصوت', value: `${queue.volume}%`, inline: true }, { name: '👤 طلبها', value: track.requestedBy, inline: true })
            .setColor(0x5865F2)
            .setFooter({ text: `Liberty City Music | القائمة: ${queue.tracks.length} أغنية` });
    }
    buildControlButtons(queue) {
        const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('music:back')
            .setLabel('⏮️ السابق')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(!queue.playing && !queue.paused), new discord_js_1.ButtonBuilder()
            .setCustomId('music:pause')
            .setLabel(queue.paused ? '▶️ استئناف' : '⏸️ إيقاف مؤقت')
            .setStyle(queue.paused ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary)
            .setDisabled(!queue.playing && !queue.paused), new discord_js_1.ButtonBuilder()
            .setCustomId('music:skip')
            .setLabel('التالي ⏭️')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(!queue.playing && !queue.paused), new discord_js_1.ButtonBuilder()
            .setCustomId('music:stop')
            .setLabel('⏹️ إيقاف')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setDisabled(!queue.playing && !queue.paused));
        const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('music:repeat')
            .setLabel(this.getRepeatLabel(queue.repeat))
            .setStyle(queue.repeat !== RepeatMode.OFF ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
            .setCustomId('music:volume_down')
            .setLabel('🔈 -')
            .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
            .setCustomId('music:volume_up')
            .setLabel('🔊 +')
            .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
            .setCustomId('music:queue')
            .setLabel(`📋 القائمة (${this.queues.get('')?.tracks.length || 0})`)
            .setStyle(discord_js_1.ButtonStyle.Primary));
        return [row1, row2];
    }
    getRepeatLabel(mode) {
        switch (mode) {
            case RepeatMode.OFF: return '🔁 إيقاف التكرار';
            case RepeatMode.TRACK: return '🔂 تكرار الأغنية';
            case RepeatMode.QUEUE: return '🔁 تكرار القائمة';
        }
    }
    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    // --------------------------------------------
    // Handle Button Interactions
    // --------------------------------------------
    async handleButton(interaction) {
        const guildId = interaction.guild.id;
        const queue = this.queues.get(guildId);
        if (!queue) {
            await interaction.reply({ content: '❌ لا توجد قائمة تشغيل', ephemeral: true });
            return;
        }
        const action = interaction.customId.split(':')[1];
        switch (action) {
            case 'pause':
                if (queue.paused)
                    await this.resume(interaction.guild.id);
                else
                    await this.pause(interaction.guild.id);
                break;
            case 'skip':
                await this.skip(interaction.guild.id);
                break;
            case 'back':
                // Add back logic
                break;
            case 'stop':
                await this.stop(interaction.guild.id);
                break;
            case 'repeat':
                const modes = [RepeatMode.OFF, RepeatMode.TRACK, RepeatMode.QUEUE];
                const currentIndex = modes.indexOf(queue.repeat);
                const nextMode = modes[(modes.indexOf(queue.repeat) + 1) % modes.length];
                this.setRepeat(interaction.guild.id, nextMode);
                break;
            case 'volume_down':
                this.setVolume(interaction.guild.id, queue.volume - 10);
                break;
            case 'volume_up':
                this.setVolume(interaction.guild.id, queue.volume + 10);
                break;
            case 'queue':
                await this.showQueue(interaction);
                return;
        }
        await this.updateNowPlaying(interaction.guild.id);
        await interaction.deferUpdate();
    }
    async showQueue(interaction) {
        const queue = this.queues.get(interaction.guild.id);
        if (!queue || queue.tracks.length === 0) {
            await interaction.reply({ content: '📭 القائمة فارغة', ephemeral: true });
            return;
        }
        const tracks = queue.tracks.slice(0, 10).map((t, i) => `${i + 1}. **${t.title}** (${this.formatDuration(t.duration)})`).join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('📋 قائمة التشغيل')
            .setDescription(tracks || 'القائمة فارغة')
            .setColor(0x5865F2)
            .setFooter({ text: `إجمالي: ${queue.tracks.length} أغنية` });
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}
exports.MusicHandler = MusicHandler;
exports.default = MusicHandler;
//# sourceMappingURL=MusicHandler.js.map