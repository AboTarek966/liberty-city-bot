import { Client, Collection } from 'discord.js';
export interface Event {
    name: string;
    once?: boolean;
    execute: (...args: any[]) => Promise<void> | void;
}
export declare class EventHandler {
    private client;
    private events;
    constructor(client: Client);
    loadEvents(): Promise<void>;
    registerEvent(event: Event): void;
    emitEvent(name: string, ...args: any[]): Promise<void>;
    getEvents(): Collection<string, Event>;
    getEvent(name: string): Event | undefined;
}
export default EventHandler;
//# sourceMappingURL=EventHandler.d.ts.map