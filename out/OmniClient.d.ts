import { Client, Collection } from 'discord.js';
import { CommandHandler, EventHandler, InteractionHandler, AIHandler, AIInvestigator, ProtectionHandler, TicketHandler, ModerationHandler, LoggingHandler, ActivityTracker, SecurityHandler, LevelingHandler, AntiAltHandler, InviteTrackerHandler, ReturnTrackerHandler, MessageScannerHandler, AIAutoModHandler, AITicketAssistant, AITranslator, EconomyHandler, GameHandler, MusicHandler, VoiceKeeperHandler, DashboardCommandWorker, WebDashboard } from './handlers';
import { Express } from 'express';
export declare class OmniClient extends Client {
    commandHandler: CommandHandler;
    eventHandler: EventHandler;
    interactionHandler: InteractionHandler;
    aiHandler: AIHandler;
    aiInvestigator: AIInvestigator;
    protectionHandler: ProtectionHandler;
    ticketHandler: TicketHandler;
    moderationHandler: ModerationHandler;
    loggingHandler: LoggingHandler;
    activityTracker: ActivityTracker;
    securityHandler: SecurityHandler;
    levelingHandler: LevelingHandler;
    antiAltHandler: AntiAltHandler;
    inviteTrackerHandler: InviteTrackerHandler;
    returnTrackerHandler: ReturnTrackerHandler;
    messageScannerHandler: MessageScannerHandler;
    aiAutoModHandler: AIAutoModHandler;
    aiTicketAssistant: AITicketAssistant;
    aiTranslator: AITranslator;
    economyHandler: EconomyHandler;
    gameHandler: GameHandler;
    musicHandler: MusicHandler;
    voiceKeeperHandler: VoiceKeeperHandler;
    dashboardCommandWorker: DashboardCommandWorker;
    webDashboard: WebDashboard;
    expressApp: Express;
    private restTokenTimer?;
    cooldowns: Collection<string, Collection<string, number>>;
    guildSettingsCache: Collection<string, any>;
    constructor();
    private setupExpress;
    private setupApiRoutes;
    private getGuildSettings;
    /**
     * طابور حفظ متسلسل لكل سيرفر — يمنع تشغيل save() متوازي على نفس وثيقة
     * Mongoose (الذي يرمي "Can't save() the same doc multiple times in parallel"
     * عند ضغط مفاتيح متعددة بسرعة من اللوحة).
     */
    private settingsUpdateQueue;
    private updateGuildSettings;
    private applyGuildSettingsUpdate;
    /**
     * مزامنة حقول `ai.*` القادمة من اللوحة/الأمر إلى AIConfig.
     * بدونها كانت اللوحة تكتب في GuildSettings بينما الردود تقرأ AIConfig — تعارض صامت.
     */
    private syncAIConfig;
    private getGuildStats;
    private getDashboardStats;
    initialize(): Promise<void>;
    private startRestTokenGuard;
    private connectDatabase;
    private loadHandlers;
    registerCommands(): Promise<void>;
    setStatus(): void;
    cleanup(): Promise<void>;
}
export default OmniClient;
//# sourceMappingURL=OmniClient.d.ts.map