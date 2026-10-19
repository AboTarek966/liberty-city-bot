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
    constructor(client: LibertyClient);
    private getQueue;
    search(query: string): Promise<Track | null>;
    addTrack(guildId: string, query: string, requestedBy: string, requestedById: string): Promise<Track | null>;
    play(member: GuildMember, query: string): Promise<{
        success: boolean;
        track?: Track;
        message: string;
    }>;
    skip(guildId: string): boolean;
    stop(guildId: string): boolean;
    pause(guildId: string): boolean;
    resume(guildId: string): boolean;
    seek(guildId: string, seconds: number): Promise<boolean>;
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