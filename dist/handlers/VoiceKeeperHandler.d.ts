import { Client } from 'discord.js';
export declare class VoiceKeeperHandler {
    private client;
    private entries;
    constructor(client: Client);
    private key;
    join(guildId: string, channelId: string, durationMs?: number): Promise<{
        ok: boolean;
        message: string;
    }>;
    leave(guildId: string, channelId?: string): Promise<{
        ok: boolean;
        message: string;
    }>;
    leaveAll(): number;
    status(): string;
    ensureOwner(userId: string): Promise<boolean>;
}
//# sourceMappingURL=VoiceKeeperHandler.d.ts.map