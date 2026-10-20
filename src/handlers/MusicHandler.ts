// ============================================
// Liberty City Bot - Music Handler
// نظام موسيقى حقيقي: @discordjs/voice + ytdl (webm/opus — بدون ffmpeg)
// البحث عبر youtube-sr، ودعم كامل: تشغيل/إيقاف/استئناف/تخطي/seek/صوت/تكرار
// ============================================

import { GuildMember, VoiceBasedChannel } from 'discord.js';
import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import { YouTube } from 'youtube-sr';
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
  private queues = new Map<string, Queue>();
  private players = new Map<string, AudioPlayer>();
  private connections = new Map<string, VoiceConnection>();
  // عدّاد للتوقفات اليدوية (تخطي/إيقاف) حتى لا يتولى الـ Idle تقدُماً إضافياً
  private manualStops = new Map<string, number>();
  // نقطة بداية البث الحالية (بالميلي ثانية) — لحساب الموضع الحالي ودعم تقديم/إرجاع
  private seekOffsets = new Map<string, number>();

  constructor(client: LibertyClient) {
    this.client = client;
    logger.info('MusicHandler initialized (real voice playback via @discordjs/voice)');
  }

  // --------------------------------------------
  // القائمة
  // --------------------------------------------
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

  // إعدادات الموسيقى من قاعدة البيانات
  private async getSettings(guildId: string): Promise<any> {
    try {
      const { getGuildSettings } = await import('../models');
      const s: any = await getGuildSettings(guildId);
      return s?.music || {};
    } catch {
      return {};
    }
  }

  // --------------------------------------------
  // البحث
  // --------------------------------------------
  async search(query: string): Promise<Track | null> {
    try {
      // رابط يوتيوب مباشر
      if (ytdl.validateURL(query)) {
        const info = await ytdl.getInfo(query);
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

      // بحث نصي عبر youtube-sr
      const video = await YouTube.searchOne(query, 'video').catch(() => null);
      if (!video?.url) return null;

      return {
        title: video.title || query,
        url: video.url,
        duration: Math.floor((video.duration || 0) / 1000),
        thumbnail: (video.thumbnail as any)?.url || '',
        requestedBy: '',
        requestedById: '',
      };
    } catch (error: any) {
      logger.error(`YouTube search error: ${error.message}`);
      return null;
    }
  }

  // إضافة للمسار (مع فحص الحد الأقصى)
  async addTrack(guildId: string, query: string, requestedBy: string, requestedById: string): Promise<Track | null> {
    const settings = await this.getSettings(guildId);
    const queue = this.getQueue(guildId);
    const maxSize = Number(settings.maxQueueSize) || 50;
    if (queue.tracks.length >= maxSize) return null;

    const track = await this.search(query);
    if (!track) return null;

    track.requestedBy = requestedBy;
    track.requestedById = requestedById;

    queue.tracks.push(track);
    return track;
  }

  // --------------------------------------------
  // الاتصال الصوتي
  // --------------------------------------------
  private connect(guildId: string, channel: VoiceBasedChannel): VoiceConnection {
    const existing = this.connections.get(guildId);
    if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
      if (existing.joinConfig.channelId !== channel.id) {
        existing.rejoin({
          channelId: channel.id,
          selfDeaf: true,
          selfMute: false,
        });
      }
      return existing;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    connection.on('stateChange', (oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Destroyed) {
        this.cleanup(guildId, false);
      } else if (newState.status === VoiceConnectionStatus.Disconnected) {
        // محاولة إعادة الاتصال خلال 15 ثانية ثم المغادرة
        Promise.race([
          entersState(connection, VoiceConnectionStatus.Ready, 15_000),
          entersState(connection, VoiceConnectionStatus.Signalling, 15_000),
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

  private getPlayer(guildId: string): AudioPlayer {
    let player = this.players.get(guildId);
    if (player) return player;

    player = createAudioPlayer();
    player.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
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
  private cleanup(guildId: string, destroyConnection = true): void {
    const connection = this.connections.get(guildId);
    if (connection) {
      this.connections.delete(guildId);
      if (destroyConnection) {
        try { connection.destroy(); } catch { /* تجاهل */ }
      }
    }
    this.players.delete(guildId);
    this.manualStops.delete(guildId);
    this.seekOffsets.delete(guildId);
  }

  // --------------------------------------------
  // بدء تشغيل الأغنية الحالية
  // --------------------------------------------
  private async startCurrent(guildId: string, beginMs = 0): Promise<boolean> {
    const queue = this.getQueue(guildId);
    const track = queue.currentTrack;
    if (!track) return false;

    const connection = this.connections.get(guildId);
    const player = this.getPlayer(guildId);
    if (!connection) return false;

    try {
      const info = await ytdl.getInfo(track.url);
      // ن prefer صيغة webm/opus حتى لا نحتاج ffmpeg
      const format =
        ytdl.chooseFormat(info.formats, {
          quality: 'highestaudio',
          filter: (f) => f.container === 'webm' && f.hasAudio && !f.hasVideo,
        }) ||
        ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audio' });

      const stream = ytdl.downloadFromInfo(info, {
        format,
        highWaterMark: 1 << 22,
        ...(beginMs > 0 ? { begin: beginMs } : {}),
      });

      const resource = createAudioResource(stream, {
        inputType: StreamType.WebmOpus,
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
    } catch (error: any) {
      logger.error(`Failed to start "${track.title}" (${guildId}): ${error.message}`);
      queue.isPlaying = false;

      // تخطي تلقائي للأغنية التالية عند فشل المصدر
      const next = queue.tracks.shift() ?? null;
      if (next) {
        queue.currentTrack = next;
        await this.startCurrent(guildId).catch(() => false);
      } else {
        queue.currentTrack = null;
        this.cleanup(guildId, true);
      }
      return false;
    }
  }

  // انتهاء الأغنية (طبيعياً أو عبر stop())
  private onTrackEnd(guildId: string): void {
    const manual = this.manualStops.get(guildId) || 0;
    if (manual > 0) {
      this.manualStops.set(guildId, manual - 1);
      return; // التوقف اليدوي يتولاه المتوقف (skip/stop)
    }

    const queue = this.getQueue(guildId);

    // تكرار الأغنية الحالية
    if (queue.loop === 'track' && queue.currentTrack) {
      this.startCurrent(guildId).catch(() => {});
      return;
    }

    this.advance(guildId);
  }

  // الانتقال للأغنية التالية
  private advance(guildId: string): void {
    const queue = this.getQueue(guildId);
    const prev = queue.currentTrack;

    // تكرار القائمة: نعيد الأغنية المنتهية للنهاية
    if (queue.loop === 'queue' && prev) queue.tracks.push(prev);

    const next = queue.tracks.shift() ?? null;
    queue.currentTrack = next;

    const player = this.players.get(guildId);
    if (player && player.state.status !== AudioPlayerStatus.Idle) {
      this.manualStops.set(guildId, (this.manualStops.get(guildId) || 0) + 1);
      player.stop();
    }

    if (next) {
      queue.isPlaying = true;
      this.startCurrent(guildId).catch(() => {});
    } else {
      queue.isPlaying = false;
      queue.currentTrack = null;
      this.cleanup(guildId, true);
    }
  }

  // --------------------------------------------
  // التشغيل
  // --------------------------------------------
  async play(
    member: GuildMember,
    query: string,
    textChannelId?: string
  ): Promise<{ success: boolean; track?: Track; message: string }> {
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
      const isAdmin = member.permissions.has('ManageGuild' as any);
      if (!isDJ && !isAdmin) {
        return { success: false, message: '🎧 وضع DJ مفعّل — يتطلب رول DJ أو صلاحية إدارة السيرفر' };
      }
    }

    // صلاحيات البوت في القناة الصوتية
    const botMember = member.guild.members.me;
    const botPerms = channel.permissionsFor(botMember!);
    if (botPerms && (!botPerms.has('Connect') || !botPerms.has('Speak'))) {
      return { success: false, message: '❌ لا أملك صلاحية الدخول/التحدث في القناة الصوتية!' };
    }

    const track = await this.addTrack(guildId, query, member.user.username, member.user.id);
    if (!track) {
      const queue = this.getQueue(guildId);
      return {
        success: false,
        message:
          queue.tracks.length >= (Number(settings.maxQueueSize) || 50)
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
      const connection = this.connections.get(guildId)!;
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch {
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
  skip(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue.currentTrack && queue.tracks.length === 0) return false;
    this.advance(guildId);
    return true;
  }

  stop(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) return false;

    queue.tracks = [];
    queue.currentTrack = null;
    queue.isPlaying = false;

    const player = this.players.get(guildId);
    if (player && player.state.status !== AudioPlayerStatus.Idle) {
      this.manualStops.set(guildId, (this.manualStops.get(guildId) || 0) + 1);
      player.stop();
    }
    this.cleanup(guildId, true);
    return true;
  }

  pause(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue.isPlaying) return false;
    const player = this.players.get(guildId);
    if (!player) return false;
    const paused = player.pause();
    if (paused) queue.isPlaying = false;
    return paused;
  }

  resume(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue.currentTrack || queue.isPlaying) return false;
    const player = this.players.get(guildId);
    if (!player) return false;
    const resumed = player.unpause();
    if (resumed) queue.isPlaying = true;
    return resumed;
  }

  // الانتقال لوقت محدد (إعادة بناء البث مع begin)
  async seek(guildId: string, seconds: number): Promise<boolean> {
    const queue = this.getQueue(guildId);
    if (!queue.currentTrack || !this.connections.has(guildId)) return false;
    return this.startCurrent(guildId, Math.max(0, seconds) * 1000);
  }

  // ⏱️ الموضع الحالي بالثواني = نقطة البداية + زمن الصوت المنplayed فعلياً
  // (playbackDuration لا يزيد أثناء الإيقاف المؤقت ⇒ دقيق بما يكفي)
  getPosition(guildId: string): number {
    const player = this.players.get(guildId);
    if (!player) return 0;
    const st = player.state;
    if (st.status !== AudioPlayerStatus.Playing && st.status !== AudioPlayerStatus.Paused) return 0;
    const offset = this.seekOffsets.get(guildId) || 0;
    return Math.floor((offset + st.resource.playbackDuration) / 1000);
  }

  // ⏩ تقديم / ⏪ إرجاع بعدد ثوانٍ (افتراضي 10)
  async forward(guildId: string, seconds = 10): Promise<number | null> {
    const target = this.getPosition(guildId) + Math.max(1, seconds);
    return (await this.seek(guildId, target)) ? target : null;
  }

  async back(guildId: string, seconds = 10): Promise<number | null> {
    const target = Math.max(0, this.getPosition(guildId) - Math.max(1, seconds));
    return (await this.seek(guildId, target)) ? target : null;
  }

  setVolume(guildId: string, volume: number): boolean {
    const queue = this.getQueue(guildId);
    queue.volume = Math.max(0, Math.min(200, volume));

    const player = this.players.get(guildId);
    const status = player?.state.status;
    const resource =
      status === AudioPlayerStatus.Playing || status === AudioPlayerStatus.Paused
        ? (player!.state as any).resource
        : null;
    if (resource?.volume) {
      resource.volume.setVolume(Math.max(0, Math.min(4, queue.volume / 100)));
    }
    return true;
  }

  setLoop(guildId: string, mode: 'none' | 'track' | 'queue'): boolean {
    const queue = this.getQueue(guildId);
    queue.loop = mode;
    return true;
  }

  shuffle(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (queue.tracks.length < 2) return false;

    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }
    return true;
  }

  removeTrack(guildId: string, position: number): Track | null {
    const queue = this.getQueue(guildId);
    if (position < 1 || position > queue.tracks.length) return null;
    return queue.tracks.splice(position - 1, 1)[0] ?? null;
  }

  getQueueInfo(guildId: string): Queue | null {
    return this.queues.get(guildId) ?? null;
  }

  getCurrentTrack(guildId: string): Track | null {
    return this.queues.get(guildId)?.currentTrack ?? null;
  }

  isConnected(guildId: string): boolean {
    const connection = this.connections.get(guildId) ?? getVoiceConnection(guildId);
    return !!connection && connection.state.status === VoiceConnectionStatus.Ready;
  }

  leave(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.tracks = [];
      queue.currentTrack = null;
      queue.isPlaying = false;
    }
    const player = this.players.get(guildId);
    if (player && player.state.status !== AudioPlayerStatus.Idle) {
      this.manualStops.set(guildId, (this.manualStops.get(guildId) || 0) + 1);
      player.stop();
    }
    this.cleanup(guildId, true);
    this.queues.delete(guildId);
    logger.info(`Left voice channel in ${guildId}`);
  }
}

export const musicHandler = (client: LibertyClient) => new MusicHandler(client);
