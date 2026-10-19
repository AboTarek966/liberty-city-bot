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
  AITicketAssistant,
  AITranslator,
  EconomyHandler,
  GameHandler,
} from './handlers';
import mongoose from 'mongoose';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';

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
  public aiTicketAssistant: AITicketAssistant;
  public aiTranslator: AITranslator;
  public economyHandler: EconomyHandler;
  public gameHandler: GameHandler;

  // Express server for Dashboard API
  public expressApp: Express;

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

    // Initialize Express app
    this.expressApp = express();
    this.setupExpress();

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
    this.aiTicketAssistant = new AITicketAssistant(this);
    this.aiTranslator = new AITranslator(this);
    this.economyHandler = new EconomyHandler(this);
    this.gameHandler = new GameHandler(this);
  }

  private setupExpress(): void {
    this.expressApp.use(cors({
      origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
      credentials: true,
    }));
    this.expressApp.use(express.json());

    // Health check
    this.expressApp.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API Routes
    this.setupApiRoutes();
  }

  private setupApiRoutes(): void {
    const router = express.Router();

    // Guild settings
    router.get('/guilds/:guildId/settings', async (req: Request, res: Response) => {
      try {
        const guildId = req.params.guildId;
        const settings = await this.getGuildSettings(guildId);
        res.json(settings);
      } catch (error) {
        logger.error('Failed to get guild settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
      }
    });

    router.patch('/guilds/:guildId/settings', async (req: Request, res: Response) => {
      try {
        const guildId = req.params.guildId;
        const updates = req.body;
        const settings = await this.updateGuildSettings(guildId, updates);
        res.json(settings);
      } catch (error) {
        logger.error('Failed to update guild settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
      }
    });

    // Guild stats
    router.get('/guilds/:guildId/stats', async (req: Request, res: Response) => {
      try {
        const guildId = req.params.guildId;
        const stats = await this.getGuildStats(guildId);
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get guild stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    // Dashboard stats
    router.get('/dashboard/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.getDashboardStats();
        res.json(stats);
      } catch (error) {
        logger.error('Failed to get dashboard stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    this.expressApp.use('/api', router);
  }

  private async getGuildSettings(guildId: string): Promise<any> {
    const { getGuildSettings } = await import('./models');
    const settings = await getGuildSettings(guildId);
    return settings.toObject();
  }

  private async updateGuildSettings(guildId: string, updates: any): Promise<any> {
    const { getGuildSettings } = await import('./models');
    const settings = await getGuildSettings(guildId);
    Object.assign(settings, updates);
    await settings.save();
    return settings.toObject();
  }

  private async getGuildStats(guildId: string): Promise<any> {
    const guild = this.guilds.cache.get(guildId);
    if (!guild) return { error: 'Guild not found' };

    return {
      memberCount: guild.memberCount,
      channelCount: guild.channels.cache.size,
      roleCount: guild.roles.cache.size,
      onlineCount: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
    };
  }

  private async getDashboardStats(): Promise<any> {
    return {
      totalGuilds: this.guilds.cache.size,
      totalUsers: this.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
      totalChannels: this.guilds.cache.reduce((acc, g) => acc + g.channels.cache.size, 0),
    };
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