import { Guild } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
import { InvestigationConfig, InvestigationReport, InvestigationTrigger } from '../types/investigator';
export declare function resolveInvestigatorConfig(settings: any): InvestigationConfig;
interface RunOptions {
    trigger: InvestigationTrigger;
    focus?: string;
    requestedBy?: string;
    deep?: boolean;
    aiMode?: 'always' | 'if-high' | 'never';
    memberId?: string;
}
export declare class AIInvestigator {
    private readonly client;
    private started;
    private timers;
    private eventScanTimers;
    private supervisor?;
    private active;
    private signals;
    private buffered;
    private lastEventScanAt;
    private joinEvents;
    private lastReports;
    constructor(client: LibertyClient);
    start(): void;
    cleanup(): void;
    private attachListeners;
    private bootstrap;
    private clearTimer;
    private initializeGuild;
    private schedule;
    private onTimer;
    private syncSchedules;
    /** يُستدعى بعد تغيير إعدادات المحقق لإعادة جدولة الفحص التلقائي */
    reschedule(guildId: string): Promise<void>;
    getRecentReport(guildId: string): InvestigationReport | undefined;
    private pushSignal;
    private pushBuffered;
    private exemptIds;
    /** فحص سريع بلا تخصيص Set لكل رسالة */
    private isExemptActor;
    private authorizedBotIds;
    private handleMessageCreate;
    private handleMemberAdd;
    private handleMemberRemove;
    private handleMemberUpdate;
    private handleAuditEntry;
    private handleWebhookUpdate;
    private handleInviteCreate;
    private handleGuildBanAdd;
    private handleGuildCreate;
    private scheduleFocusedScan;
    run(guild: Guild, options: RunOptions): Promise<InvestigationReport>;
    investigateMember(guild: Guild, userId: string, requestedBy?: string): Promise<InvestigationReport>;
    getConfig(guildId: string): Promise<InvestigationConfig>;
    getStatus(guildId: string): Promise<{
        config: InvestigationConfig;
        latest: any;
        openFindings: number;
        criticalOpen: number;
        highOpen: number;
        providers: string[];
        aiAvailable: boolean;
    }>;
    private executeRun;
    private buildSnapshotOptions;
    private applyMemberFocus;
    private prioritizeMemberFindings;
    private sanitizeFindings;
    private sanitizeTextList;
    private buildFallbackSummary;
    private buildAIPackets;
    private buildAIPrompt;
    private buildMemberFocus;
    private memberToSnapshot;
    private persistFindings;
    private autoResolve;
    private alertIfNeeded;
}
export {};
//# sourceMappingURL=AIInvestigator.d.ts.map