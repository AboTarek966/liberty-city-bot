import { Message } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
export interface AutoModConfig {
    enabled: boolean;
    categories: {
        spam: boolean;
        toxicity: boolean;
        nsfw: boolean;
        scam: boolean;
        threat: boolean;
        pii: boolean;
        raid: boolean;
        selfharm: boolean;
    };
    sensitivity: number;
    actions: {
        spam: 'delete' | 'warn' | 'mute' | 'ban';
        toxicity: 'delete' | 'warn' | 'mute' | 'ban';
        nsfw: 'delete' | 'warn' | 'mute' | 'ban';
        scam: 'delete' | 'warn' | 'mute' | 'ban';
        threat: 'delete' | 'warn' | 'mute' | 'ban';
        pii: 'delete' | 'warn' | 'mute' | 'ban';
        raid: 'delete' | 'warn' | 'mute' | 'ban';
        selfharm: 'delete' | 'warn' | 'mute' | 'ban' | 'resources';
    };
    muteDuration: number;
    ignoredChannels: string[];
    ignoredRoles: string[];
    logChannel?: string;
    escalation: boolean;
    maxWarningsBeforeEscalation: number;
}
export interface AutoModResult {
    flagged: boolean;
    categories: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    action: 'delete' | 'warn' | 'mute' | 'ban' | 'resources' | 'none';
    reason: string;
    confidence: number;
    suggestedResponse?: string;
}
export declare class AIAutoModHandler {
    private client;
    private aiHandler;
    private warningCounts;
    private recentMessages;
    constructor(client: LibertyClient);
    scanMessage(message: Message): Promise<AutoModResult | null>;
    private getConfig;
    private buildContext;
    private getRecentContext;
    private trackMessage;
    private analyzeWithAI;
    private executeAction;
    private warnUser;
    private muteUser;
    private banUser;
    private sendHelpResources;
    private trackWarning;
    private logAction;
    updateConfig(guildId: string, updates: Partial<AutoModConfig>): Promise<void>;
    getConfigForGuild(guildId: string): Promise<AutoModConfig>;
}
export default AIAutoModHandler;
//# sourceMappingURL=AIAutoMod.d.ts.map