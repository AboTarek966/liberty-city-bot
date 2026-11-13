import { Client, Message, GuildMember } from 'discord.js';
interface ProtectionAction {
    type: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
    reason: string;
    duration?: number;
    /** 🚫 تجاوز نظام "التحذير قبل الحظر" (الجدار الوقائي) — الحظر فوري: محتوى إباحي */
    directBan?: boolean;
}
export declare class ProtectionHandler {
    private client;
    private spamTracker;
    private raidTracker;
    private userCooldowns;
    private verificationState;
    private threatAlertCooldown;
    private recoveryTimers;
    private lockdownRecoveryTimers;
    constructor(client: Client);
    private webhookSpamCooldown;
    handleWebhookMessage(message: Message): Promise<boolean>;
    checkMessage(message: Message): Promise<ProtectionAction | null>;
    private checkAntiSpam;
    private checkAntiLink;
    private checkAntiInvite;
    private checkAntiMention;
    private checkAntiCaps;
    private checkAntiEmoji;
    private checkAutoMod;
    private checkZalgo;
    /** قائمة صارمة عمداً — كل الكلمات هنا إباحية/صريحة، بدون أي كلمة عربية بريئة تطابق كـ substring */
    private static readonly EXPLICIT_RE;
    private checkAntiExplicit;
    private executeAction;
    private executeUserAction;
    private logAction;
    checkRaid(member: GuildMember): Promise<{
        isRaid: boolean;
        action?: ProtectionAction;
    }>;
    applyBeastMode(guild: any, settings: any): Promise<void>;
    private scheduleRecovery;
    private scheduleLockdownRecovery;
    private lockdown;
    private hasIgnoredRole;
    private isIgnoredChannel;
    /** 🎯 الحمايات المعطّلة في قناة معينة */
    static disabledChecksInChannel(settings: any, channelId: string): string[];
    private getProtectionKey;
    private sendAIRaidSummary;
    cleanup(): void;
}
export default ProtectionHandler;
//# sourceMappingURL=ProtectionHandler.d.ts.map