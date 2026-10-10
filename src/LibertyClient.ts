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
  // --------------------------------------------
  async registerCommands(): Promise<void> {
    await this.commandHandler.registerCommands(
      config.discord.clientId,
      config.discord.token,
      config.discord.guildId
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