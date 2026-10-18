import { Client, Collection } from 'discord.js';
import { CommandHandler, EventHandler, InteractionHandler, AIHandler, ProtectionHandler, TicketHandler, ModerationHandler, LoggingHandler, ActivityTracker, SecurityHandler, LevelingHandler, AntiAltHandler, InviteTrackerHandler, MessageScannerHandler, AIAutoModHandler } from './handlers';
export declare class LibertyClient extends Client {
    commandHandler: CommandHandler;
    eventHandler: EventHandler;
    interactionHandler: InteractionHandler;
    aiHandler: AIHandler;
    protectionHandler: ProtectionHandler;
    ticketHandler: TicketHandler;
    moderationHandler: ModerationHandler;
    loggingHandler: LoggingHandler;
    activityTracker: ActivityTracker;
    securityHandler: SecurityHandler;
    levelingHandler: LevelingHandler;
    antiAltHandler: AntiAltHandler;
    inviteTrackerHandler: InviteTrackerHandler;
    messageScannerHandler: MessageScannerHandler;
    aiAutoModHandler: AIAutoModHandler;
    cooldowns: Collection<string, Collection<string, number>>;
    guildSettingsCache: Collection<string, any>;
    constructor();
    initialize(): Promise<void>;
    private connectDatabase;
    private loadHandlers;
    registerCommands(): Promise<void>;
    registerCommandsForGuild(guildId: string): Promise<void>;
    setStatus(): void;
    cleanup(): Promise<void>;
}
export default LibertyClient;
//# sourceMappingURL=LibertyClient.d.ts.map