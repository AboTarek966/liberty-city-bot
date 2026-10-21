import { GuildMember, VoiceBasedChannel, EmbedBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
export interface Track {
    title: string;
    url: string;
    duration: number;
    thumbnail: string;
    requestedBy: string;
    requestedById: string;
    /** مصدر الأغنية — soundcloud يُشغَّل عبر ffmpeg، وyoutube عبر Innertube */
    source?: 'youtube' | 'soundcloud';
    /** رابط ترميز SoundCloud (HLS) لإعادة بناء البث عند التشغيل/البحث */
    scTranscodingUrl?: string;
}
export interface Queue {
    tracks: Track[];
    currentTrack: Track | null;
    isPlaying: boolean;
    volume: number;
    loop: 'none' | 'track' | 'queue';
    /** رسالة لوحة التحكم التلقائية (في روم الصوت أو روم النص) */
    panel?: {
        channelId: string;
        messageId: string;
    };
}
export declare class MusicHandler {
    private client;
    private queues;
    private players;
    private connections;
    private manualStops;
    private seekOffsets;
    private ffprocs;
    private lastPlayMs;
    private scPrefetched;
    private cpuMeter?;
    private cpuWall;
    private cpuNode;
    private cpuFfTicks;
    private cpuTidTicks;
    private profStarted;
    constructor(client: LibertyClient);
    private cpuTick;
    private startProfile;
    private stopProfile;
    private resolveFfmpeg;
    private runSelfTest;
    private selfTest;
    private getQueue;
    private getSettings;
    search(query: string): Promise<Track | null>;
    private searchSoundCloud;
    private searchSoundCloudUrl;
    private searchYoutubeUrl;
    private searchInnertube;
    private innertubeSearchOnce;
    private innertubeStream;
    private pumpChunks;
    private fetchChunk;
    addTrack(guildId: string, query: string, requestedBy: string, requestedById: string): Promise<Track | null>;
    private connect;
    private getPlayer;
    private cleanup;
    private startCurrent;
    private prefetchScStream;
    private takePrefetched;
    private startSoundcloud;
    private killFfmpeg;
    private onTrackEnd;
    private advance;
    play(member: GuildMember, query: string, textChannelId?: string): Promise<{
        success: boolean;
        track?: Track;
        message: string;
    }>;
    panelRows(): ActionRowBuilder<ButtonBuilder>[];
    panelEmbed(guildId: string, userTag?: string): EmbedBuilder | null;
    sendControlPanel(guildId: string, voiceChannel: VoiceBasedChannel, textChannelId?: string, userTag?: string): Promise<void>;
    refreshPanel(guildId: string): Promise<void>;
    skip(guildId: string): boolean;
    stop(guildId: string): boolean;
    pause(guildId: string): boolean;
    resume(guildId: string): boolean;
    seek(guildId: string, seconds: number): Promise<boolean>;
    getPosition(guildId: string): number;
    forward(guildId: string, seconds?: number): Promise<number | null>;
    back(guildId: string, seconds?: number): Promise<number | null>;
    setVolume(guildId: string, volume: number): boolean;
    setLoop(guildId: string, mode: 'none' | 'track' | 'queue'): boolean;
    shuffle(guildId: string): boolean;
    removeTrack(guildId: string, position: number): Track | null;
    getQueueInfo(guildId: string): Queue | null;
    getCurrentTrack(guildId: string): Track | null;
    isConnected(guildId: string): boolean;
    leave(guildId: string): void;
}
export declare const musicHandler: (client: LibertyClient) => MusicHandler;
//# sourceMappingURL=MusicHandler.d.ts.map