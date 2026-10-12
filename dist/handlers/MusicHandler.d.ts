import { Client, VoiceChannel, TextChannel } from 'discord.js';
export interface Track {
    title: string;
    url: string;
    duration: number;
    thumbnail: string;
    requestedBy: string;
    source: 'youtube' | 'soundcloud' | 'direct';
}
export interface Queue {
    tracks: Track[];
    current: Track | null;
    playing: boolean;
    paused: boolean;
    volume: number;
    repeat: 'off' | 'track' | 'queue';
    textChannel: TextChannel | null;
    voiceChannel: VoiceChannel | null;
    message: any;
}
export declare enum RepeatMode {
    OFF = "off",
    TRACK = "track",
    QUEUE = "queue"
}
export declare class MusicHandler {
    private client;
    private queues;
    private ytdl;
    constructor(client: Client);
    private initYtdl;
    getQueue(guildId: string): Queue | undefined;
    createQueue(guildId: string): Queue;
    deleteQueue(guildId: string): void;
    search(query: string): Promise<Track[]>;
    play(guildId: string, track: Track, interaction: any): Promise<void>;
    private processQueue;
    private simulatePlay;
    skip(guildId: string): Promise<boolean>;
    pause(guildId: string): Promise<boolean>;
    resume(guildId: string): Promise<boolean>;
    stop(guildId: string): Promise<void>;
    setVolume(guildId: string, volume: number): boolean;
    setRepeat(guildId: string, mode: RepeatMode): boolean;
    private updateNowPlaying;
    private buildNowPlayingEmbed;
    private buildControlButtons;
    private getRepeatLabel;
    private formatDuration;
    handleButton(interaction: any): Promise<void>;
    private showQueue;
}
export default MusicHandler;
//# sourceMappingURL=MusicHandler.d.ts.map