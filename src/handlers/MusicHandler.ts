// ============================================
// Liberty City Bot - Music Handler
// نظام الموسيقى مع دعم يوتيوب وقوائم التشغيل
// ملاحظة: يتطلب تثبيت @discordjs/voice و @discordjs/opus للعمل الصوتي الفعلي
// ============================================

import { Guild, GuildMember, VoiceChannel } from 'discord.js';
import ytdl from '@distube/ytdl-core';
import { createLogger } from '../utils/helpers';
import { LibertyClient } from '../LibertyClient';

const logger = createLogger('MusicHandler');

export interface Track {
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  requestedBy: string;
  requestedById: string;
}

export interface Queue {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  loop: 'none' | 'track' | 'queue';
}

export class MusicHandler {
  private client: LibertyClient;
  private queues: Map<string, Queue> = new Map();

  constructor(client: LibertyClient) {
    this.client = client;
    logger.info('MusicHandler initialized (voice features require @discordjs/voice)');
  }

  // الحصول على كيو السيرفر أو إنشاؤه
  private getQueue(guildId: string): Queue {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        tracks: [],
        currentTrack: null,
        isPlaying: false,
        volume: 100,
        loop: 'none',
      });
    }
    return this.queues.get(guildId)!;
  }

  // البحث عن أغنية في يوتيوب
  async search(query: string): Promise<Track | null> {
    try {
      let videoInfo;
      const isUrl = ytdl.validateURL(query);

      if (isUrl) {
        videoInfo = await ytdl.getInfo(query);
      } else {
        // استخدام البحث عبر getInfo مع query للبحث
        videoInfo = await ytdl.getInfo(query);
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
    } catch (error: any) {
      logger.error('YouTube search error:', error);
      return null;
    }
  }

  // إضافة للمسار
  async addTrack(guildId: string, query: string, requestedBy: string, requestedById: string): Promise<Track | null> {
    const track = await this.search(query);
    if (!track) return null;

    track.requestedBy = requestedBy;
    track.requestedById = requestedById;

    const queue = this.getQueue(guildId);
    queue.tracks.push(track);
    return track;
  }

  // تشغيل (Placeholder - يتطلب @discordjs/voice)
  async play(member: GuildMember, query: string): Promise<{ success: boolean; track?: Track; message: string }> {
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
    } else {
      const position = queue.tracks.length;
      return { success: true, track, message: `✅ **أضيفت للقائمة (#${position}):** ${track.title}` };
    }
  }

  // تخطي
  skip(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue.isPlaying && queue.tracks.length === 0) return false;
    
    // TODO: Implement actual skip with voice connection
    queue.currentTrack = queue.tracks.shift() ?? null;
    return true;
  }

  // إيقاف
  stop(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue.isPlaying && queue.tracks.length === 0) return false;

    queue.tracks = [];
    queue.currentTrack = null;
    queue.isPlaying = false;
    return true;
  }

  // إيقاف مؤقت / استئناف
  pause(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue.isPlaying) return false;
    queue.isPlaying = false;
    // TODO: Implement actual pause with voice connection
    return true;
  }

  resume(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue.currentTrack || queue.isPlaying) return false;
    queue.isPlaying = true;
    // TODO: Implement actual resume with voice connection
    return true;
  }

  // تقديم / تأخير (Seek)
  async seek(guildId: string, seconds: number): Promise<boolean> {
    // TODO: Implement with voice connection
    return false;
  }

  // التحكم في الصوت
  setVolume(guildId: string, volume: number): boolean {
    const queue = this.getQueue(guildId);
    queue.volume = Math.max(0, Math.min(200, volume));
    // TODO: Apply to voice connection
    return true;
  }

  // تكرار
  setLoop(guildId: string, mode: 'none' | 'track' | 'queue'): boolean {
    const queue = this.getQueue(guildId);
    queue.loop = mode;
    return true;
  }

  // خلط القائمة
  shuffle(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (queue.tracks.length < 2) return false;
    
    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }
    return true;
  }

  // إزالة من القائمة
  removeTrack(guildId: string, position: number): Track | null {
    const queue = this.getQueue(guildId);
    if (position < 1 || position > queue.tracks.length) return null;
    return queue.tracks.splice(position - 1, 1)[0] ?? null;
  }

  // الحصول على القائمة
  getQueueInfo(guildId: string): Queue | null {
    return this.queues.get(guildId) ?? null;
  }

  // الأغنية الحالية
  getCurrentTrack(guildId: string): Track | null {
    const queue = this.getQueue(guildId);
    return queue.currentTrack ?? null;
  }

  // التحقق من وجود اتصال
  isConnected(guildId: string): boolean {
    return false; // Placeholder
  }

  // مغادرة القناة الصوتية
  leave(guildId: string): void {
    this.queues.delete(guildId);
    logger.info(`Left voice channel in ${guildId}`);
  }
}

export const musicHandler = (client: LibertyClient) => new MusicHandler(client);