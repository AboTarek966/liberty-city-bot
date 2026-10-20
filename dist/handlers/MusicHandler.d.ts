import { GuildMember } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
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
export declare class MusicHandler {
    private client;
    private queues;
    private players;
    private connections;
    private manualStops;
    private seekOffsets;
    constructor(client: LibertyClient);
    private getQueue;
    private getSettings;
    search(query: string): Promise<Track | null>;
    addTrack(guildId: string, query: string, requestedBy: string, requestedById: string): Promise<Track | null>;
    private connect;
    private getPlayer;
    private cleanup;
    private startCurrent;
    private onTrackEnd;
    private advance;
    play(member: GuildMember, query: string, textChannelId?: string): Promise<{
        success: boolean;
        track?: Track;
        message: string;
    }>;
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