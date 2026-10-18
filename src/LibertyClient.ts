// ============================================
// Liberty City Bot - Main Client
// ============================================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  ActivityType,
} from 'discord.js';
import { config, validateConfig } from './config';
import { createLogger } from './utils/helpers';
import {
  CommandHandler,
  EventHandler,
  InteractionHandler,
  AIHandler,
  ProtectionHandler,
  TicketHandler,
  ModerationHandler,
  LoggingHandler,
  ActivityTracker,
  SecurityHandler,
  LevelingHandler,
  AntiAltHandler,
  InviteTrackerHandler,
  MessageScannerHandler,
  AIAutoModHandler,
} from './handlers';
import mongoose from 'mongoose';

const logger = createLogger('LibertyCity');

// --------------------------------------------
// Liberty Client Class
// --------------------------------------------
export class LibertyClient extends Client {
  // Handlers
  public commandHandler: CommandHandler;
  public eventHandler: EventHandler;
  public interactionHandler: InteractionHandler;
  public aiHandler: AIHandler;
  public protectionHandler: ProtectionHandler;
  public ticketHandler: TicketHandler;
  public moderationHandler: ModerationHandler;
  public loggingHandler: LoggingHandler;
  public activityTracker: ActivityTracker;
  public securityHandler: SecurityHandler;
  public levelingHandler: LevelingHandler;
  public antiAltHandler: AntiAltHandler;
  public inviteTrackerHandler: InviteTrackerHandler;
  public messageScannerHandler: MessageScannerHandler;
  public aiAutoModHandler: AIAutoModHandler;

  // Cooldowns
  public cooldowns: Collection<string, Collection<string, number>> = new Collection();

  // Cache
  public guildSettingsCache: Collection<string, any> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
      allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: false,
      },
    });

    // Initialize handlers
    this.commandHandler = new CommandHandler(this);
    this.eventHandler = new EventHandler(this);
    this.interactionHandler = new InteractionHandler(this);
    this.aiHandler = new AIHandler(this);
    this.protectionHandler = new ProtectionHandler(this);
    this.ticketHandler = new TicketHandler(this);
    this.moderationHandler = new ModerationHandler(this);
    this.loggingHandler = new LoggingHandler(this);
    this.activityTracker = new ActivityTracker(this);
    this.securityHandler = new SecurityHandler(this);
    this.levelingHandler = new LevelingHandler(this);
    this.antiAltHandler = new AntiAltHandler(this);
    this.inviteTrackerHandler = new InviteTrackerHandler(this);
    this.messageScannerHandler = new MessageScannerHandler(config.apis.virustotal || process.env.VIRUSTOTAL_API_KEY);
    this.aiAutoModHandler = new AIAutoModHandler(this);
  }

  // --------------------------------------------
  // Initialize Bot
  // --------------------------------------------
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing Liberty City Bot...');

      // Validate configuration
      validateConfig();

      // Connect to MongoDB
      await this.connectDatabase();

      // Load handlers
      await this.loadHandlers();

      // Login to Discord
      await this.login(config.discord.token);

      logger.info('✅ Liberty City Bot initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  // --------------------------------------------
  // Connect to Database
  // --------------------------------------------
  private async connectDatabase(): Promise<void> {
    try {
      await mongoose.connect(config.database.uri);
      logger.info('📦 Connected to MongoDB');

      // 🔄 مزامنة فهرس الاختصارات — فك الفهرس الفريد القديم ليسمح
      // باستخدام نفس الاختصار لأكثر من أمر (نظام التبديل/Toggle)
      try {
        const { CommandAlias } = await import('./models');
        await CommandAlias.collection.dropIndex('guildId_1_alias_1').catch(() => {});
        await CommandAlias.createIndexes().catch(() => {});
      } catch (e: any) {
        logger.warn(`Alias index sync skipped: ${e.message}`);
      }
    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  // --------------------------------------------
  // Load Handlers
  // --------------------------------------------
  private async loadHandlers(): Promise<void> {
    // Load commands
    await this.commandHandler.loadCommands();

    // Load events
    await this.eventHandler.loadEvents();

    // Load interactions
    await this.interactionHandler.loadInteractions();

    logger.info('📚 All handlers loaded');
  }

  // --------------------------------------------
  // Register Slash Commands
  // تسجيل الأوامر في كل السيرفرات التي يوجد فيها البوت
  // (الإعدادات والأوامر متاحة في كل سيرفر بشكل مستقل)
  // --------------------------------------------
  async registerCommands(): Promise<void> {
    const guildIds = Array.from(this.guilds.cache.keys());

    if (guildIds.length === 0) {
      // لا يوجد سيرفرات — سجّل عالمياً كاحتياط
      await this.commandHandler.registerCommands(
        config.discord.clientId,
        config.discord.token
      );
      return;
    }

    let ok = 0;
    for (const guildId of guildIds) {
      try {
        await this.commandHandler.registerCommands(
          config.discord.clientId,
          config.discord.token,
          guildId
        );
        ok++;
      } catch (error) {
        logger.warn(`Failed to register commands for guild ${guildId}:`, error);
      }
    }
    logger.info(`✅ Registered slash commands in ${ok}/${guildIds.length} server(s)`);
  }

  // تسجيل الأوامر في سيرفر واحد (يُستدعى عند انضمام سيرفر جديد)
  async registerCommandsForGuild(guildId: string): Promise<void> {
    await this.commandHandler.registerCommands(
      config.discord.clientId,
      config.discord.token,
      guildId
    );
  }

  // --------------------------------------------
  // Set Bot Status
  // --------------------------------------------
  setStatus(): void {
    const activities = [
      { name: 'Liberty City', type: ActivityType.Playing },
      { name: 'حماية سيرفرك', type: ActivityType.Watching },
      { name: 'المساعدة بالأوامر', type: ActivityType.Listening },
      { name: 'أوامر /help', type: ActivityType.Competing },
    ];

    const activity = activities[Math.floor(Math.random() * activities.length)];

    this.user?.setPresence({
      activities: [activity],
      status: 'online',
    });
  }

  // --------------------------------------------
  // Cleanup (Graceful Shutdown)
  // --------------------------------------------
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up...');

    this.protectionHandler.cleanup();
    this.ticketHandler.cleanup();
    this.loggingHandler.cleanup();
    this.activityTracker.cleanup();
    this.securityHandler.cleanup();
    this.levelingHandler.cleanup();

    await mongoose.disconnect();
    logger.info('📦 Disconnected from MongoDB');

    this.destroy();
    logger.info('👋 Bot destroyed');
  }
}

export default LibertyClient;