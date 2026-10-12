import { Client, Message, GuildMember } from 'discord.js';
interface ProtectionAction {
    type: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
    reason: string;
    duration?: number;
}
export declare class ProtectionHandler {
    private client;
    private spamTracker;
    private raidTracker;
    private userCooldowns;
    constructor(client: Client);
    checkMessage(message: Message): Promise<ProtectionAction | null>;
    private checkAntiSpam;
    private checkAntiLink;
    private checkAntiInvite;
    private checkAntiMention;
    private checkAntiCaps;
    private checkAntiEmoji;
    private checkAutoMod;
    private checkZalgo;
    private executeAction;
    private executeUserAction;
    private logAction;
    checkRaid(member: GuildMember): Promise<{
        isRaid: boolean;
        action?: ProtectionAction;
    }>;
    private lockdown;
    private hasIgnoredRole;
    private isIgnoredChannel;
    private getProtectionKey;
    cleanup(): void;
}
export default ProtectionHandler;
//# sourceMappingURL=ProtectionHandler.d.ts.map