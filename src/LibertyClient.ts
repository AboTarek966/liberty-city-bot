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
  AIInvestigator,
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
  MusicHandler,
  DashboardCommandWorker,
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
  public aiInvestigator: AIInvestigator;
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
  public musicHandler: MusicHandler;
  public dashboardCommandWorker: DashboardCommandWorker;

  // Express server for Dashboard API
  public expressApp: Express;

  // مؤقّت إعادة تثبيت توكن REST (يُمسح تلقائياً عند أي 401 في @discordjs/rest)
  private restTokenTimer?: NodeJS.Timeout;

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
    this.aiInvestigator = new AIInvestigator(this);
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
    this.musicHandler = new MusicHandler(this);
    this.dashboardCommandWorker = new DashboardCommandWorker(this);
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

    // Guild roles (for the members-page role manager)
    router.get('/guilds/:guildId/roles', async (req: Request, res: Response) => {
      try {
        const guild = this.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        const roles = guild.roles.cache
          .filter(r => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }));
        res.json(roles);
      } catch (error) {
        logger.error('Failed to get guild roles:', error);
        res.status(500).json({ error: 'Failed to get roles' });
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

    // Guild tickets
    router.get('/guilds/:guildId/tickets', async (req: Request, res: Response) => {
      try {
        const { Ticket } = await import('./models');
        const tickets = await Ticket.find({ guildId: req.params.guildId })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        res.json(tickets);
      } catch (error) {
        logger.error('Failed to get tickets:', error);
        res.status(500).json({ error: 'Failed to get tickets' });
      }
    });

    router.post('/guilds/:guildId/tickets/:ticketId/claim', async (req: Request, res: Response) => {
      try {
        const { Ticket } = await import('./models');
        const ticket = await Ticket.findOneAndUpdate(
          { channelId: req.params.ticketId, guildId: req.params.guildId },
          { status: 'claimed', claimedBy: req.body.claimedBy, claimHistory: { $concatArrays: ['$claimHistory', [req.body.claimedBy]] } },
          { new: true }
        );
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        res.json(ticket);
      } catch (error) {
        logger.error('Failed to claim ticket:', error);
        res.status(500).json({ error: 'Failed to claim ticket' });
      }
    });

    router.post('/guilds/:guildId/tickets/:ticketId/close', async (req: Request, res: Response) => {
      try {
        const { Ticket } = await import('./models');
        const ticket = await Ticket.findOneAndUpdate(
          { channelId: req.params.ticketId, guildId: req.params.guildId },
          { status: 'closed', closedBy: req.body.closedBy, closeReason: req.body.reason, closedAt: new Date() },
          { new: true }
        );
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        res.json(ticket);
      } catch (error) {
        logger.error('Failed to close ticket:', error);
        res.status(500).json({ error: 'Failed to close ticket' });
      }
    });

    // Guild members
    router.get('/guilds/:guildId/members', async (req: Request, res: Response) => {
      try {
        const guild = this.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        
        const members = await guild.members.fetch();
        const memberList = members.map(m => ({
          id: m.id,
          username: m.user.username,
          discriminator: m.user.discriminator,
          avatar: m.user.avatar,
          nickname: m.nickname,
          roles: m.roles.cache
            .filter(r => r.id !== guild.id)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position })),
          joinedAt: m.joinedAt?.toISOString(),
          presence: m.presence?.status || 'offline',
          bot: m.user.bot,
        }));
        res.json(memberList);
      } catch (error) {
        logger.error('Failed to get members:', error);
        res.status(500).json({ error: 'Failed to get members' });
      }
    });

    router.post('/guilds/:guildId/members/:memberId/warn', async (req: Request, res: Response) => {
      try {
        const { ModerationCase, getNextCaseId } = await import('./models');
        const guild = this.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        
        const caseId = await getNextCaseId(req.params.guildId);
        const warning = await ModerationCase.create({
          guildId: req.params.guildId,
          caseId,
          type: 'warn',
          moderatorId: req.body.moderatorId,
          targetId: req.params.memberId,
          reason: req.body.reason,
          active: true,
        });
        res.json(warning);
      } catch (error) {
        logger.error('Failed to warn member:', error);
        res.status(500).json({ error: 'Failed to warn member' });
      }
    });

    router.post('/guilds/:guildId/members/:memberId/kick', async (req: Request, res: Response) => {
      try {
        const { ModerationCase, getNextCaseId } = await import('./models');
        const guild = this.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        
        const member = await guild.members.fetch(req.params.memberId).catch(() => null);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        
        await member.kick(req.body.reason);
        
        const caseId = await getNextCaseId(req.params.guildId);
        await ModerationCase.create({
          guildId: req.params.guildId,
          caseId,
          type: 'kick',
          moderatorId: req.body.moderatorId,
          targetId: req.params.memberId,
          reason: req.body.reason,
          active: true,
        });
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to kick member:', error);
        res.status(500).json({ error: 'Failed to kick member' });
      }
    });

    router.post('/guilds/:guildId/members/:memberId/ban', async (req: Request, res: Response) => {
      try {
        const { ModerationCase, getNextCaseId } = await import('./models');
        const guild = this.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        
        await guild.members.ban(req.params.memberId, { reason: req.body.reason });
        
        const caseId = await getNextCaseId(req.params.guildId);
        await ModerationCase.create({
          guildId: req.params.guildId,
          caseId,
          type: 'ban',
          moderatorId: req.body.moderatorId,
          targetId: req.params.memberId,
          reason: req.body.reason,
          active: true,
        });
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to ban member:', error);
        res.status(500).json({ error: 'Failed to ban member' });
      }
    });

    // Guild logs
    router.get('/guilds/:guildId/logs', async (req: Request, res: Response) => {
      try {
        const { ModerationCase } = await import('./models');
        const { type, userId, limit = 50, page = 1 } = req.query;
        const query: any = { guildId: req.params.guildId };
        if (type) query.type = type;
        if (userId) query.targetId = userId;
        
        const logs = await ModerationCase.find(query)
          .sort({ createdAt: -1 })
          .skip((Number(page) - 1) * Number(limit))
          .limit(Number(limit))
          .lean();
        
        const total = await ModerationCase.countDocuments(query);
        res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
      } catch (error) {
        logger.error('Failed to get logs:', error);
        res.status(500).json({ error: 'Failed to get logs' });
      }
    });

    // Guild economy
    router.get('/guilds/:guildId/economy', async (req: Request, res: Response) => {
      try {
        const { UserProfile } = await import('./models');
        const users = await UserProfile.find({ guildId: req.params.guildId })
          .sort({ balance: -1 })
          .limit(50)
          .lean();
        res.json(users);
      } catch (error) {
        logger.error('Failed to get economy:', error);
        res.status(500).json({ error: 'Failed to get economy' });
      }
    });

    router.post('/guilds/:guildId/economy/give', async (req: Request, res: Response) => {
      try {
        const { UserProfile, getOrCreateUserProfile } = await import('./models');
        const { userId, amount, type = 'balance' } = req.body;
        const profile = await getOrCreateUserProfile(userId, req.params.guildId);
        (profile as any)[type] = ((profile as any)[type] || 0) + Number(amount);
        await profile.save();
        res.json(profile);
      } catch (error) {
        logger.error('Failed to give economy:', error);
        res.status(500).json({ error: 'Failed to give economy' });
      }
    });

    router.post('/guilds/:guildId/economy/reset', async (req: Request, res: Response) => {
      try {
        const { UserProfile } = await import('./models');
        await UserProfile.deleteMany({ guildId: req.params.guildId });
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to reset economy:', error);
        res.status(500).json({ error: 'Failed to reset economy' });
      }
    });

    // Guild shop
    router.get('/guilds/:guildId/shop', async (req: Request, res: Response) => {
      try {
        const { getGuildSettings } = await import('./models');
        const settings = await getGuildSettings(req.params.guildId);
        res.json(settings.shop?.items || []);
      } catch (error) {
        logger.error('Failed to get shop:', error);
        res.status(500).json({ error: 'Failed to get shop' });
      }
    });

    router.post('/guilds/:guildId/shop', async (req: Request, res: Response) => {
      try {
        const { getGuildSettings } = await import('./models');
        const settings = await getGuildSettings(req.params.guildId);
        settings.shop = settings.shop || { enabled: true, items: [] };
        settings.shop.items.push(req.body);
        await settings.save();
        res.json(settings.shop.items);
      } catch (error) {
        logger.error('Failed to add shop item:', error);
        res.status(500).json({ error: 'Failed to add shop item' });
      }
    });

    router.delete('/guilds/:guildId/shop/:itemId', async (req: Request, res: Response) => {
      try {
        const { getGuildSettings } = await import('./models');
        const settings = await getGuildSettings(req.params.guildId);
        settings.shop.items = settings.shop.items.filter((i: any) => i.id !== req.params.itemId);
        await settings.save();
        res.json(settings.shop.items);
      } catch (error) {
        logger.error('Failed to delete shop item:', error);
        res.status(500).json({ error: 'Failed to delete shop item' });
      }
    });

    // Welcome messages
    router.get('/guilds/:guildId/welcome', async (req: Request, res: Response) => {
      try {
        const { getGuildSettings } = await import('./models');
        const settings = await getGuildSettings(req.params.guildId);
        res.json(settings.welcome || {});
      } catch (error) {
        logger.error('Failed to get welcome:', error);
        res.status(500).json({ error: 'Failed to get welcome' });
      }
    });

    // Protection features
    router.post('/guilds/:guildId/protection/:feature', async (req: Request, res: Response) => {
      try {
        const { getGuildSettings } = await import('./models');
        const settings = await getGuildSettings(req.params.guildId);
        const feature = req.params.feature as any;
        const prot = (settings as any).protection;
        if (prot[feature]) {
          prot[feature].enabled = req.body.enabled;
          await settings.save();
          res.json(prot[feature]);
        } else {
          res.status(404).json({ error: 'Feature not found' });
        }
      } catch (error) {
        logger.error('Failed to update protection:', error);
        res.status(500).json({ error: 'Failed to update protection' });
      }
    });

    // AI features
    router.post('/guilds/:guildId/ai/:feature', async (req: Request, res: Response) => {
      try {
        const { getGuildSettings } = await import('./models');
        const settings = await getGuildSettings(req.params.guildId);
        const feature = req.params.feature as any;
        const prot = (settings as any).protection;
        if (prot[feature]) {
          prot[feature].enabled = req.body.enabled;
          Object.assign(prot[feature], req.body.config || {});
          await settings.save();
          res.json(prot[feature]);
        } else {
          res.status(404).json({ error: 'Feature not found' });
        }
      } catch (error) {
        logger.error('Failed to update AI:', error);
        res.status(500).json({ error: 'Failed to update AI' });
      }
    });

    // Bot leave guild
    router.post('/guilds/:guildId/leave', async (req: Request, res: Response) => {
      try {
        const guild = this.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        await guild.leave();
        res.json({ success: true });
      } catch (error) {
        logger.error('Failed to leave guild:', error);
        res.status(500).json({ error: 'Failed to leave guild' });
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
    // Deep merge (up to 2 levels) so section updates like { protection: { antiRaid: {...} } }
    // merge into the existing section instead of replacing it entirely.
    for (const [key, value] of Object.entries(updates)) {
      if ((key as string).startsWith('$')) continue;
      const current = (settings as any)[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
          const subCurrent = current[subKey];
          if (subValue && typeof subValue === 'object' && !Array.isArray(subValue) && subCurrent && typeof subCurrent === 'object' && !Array.isArray(subCurrent)) {
            Object.assign(subCurrent, subValue);
          } else {
            current[subKey] = subValue;
          }
        }
      } else {
        (settings as any)[key] = value;
      }
    }
    settings.markModified('protection');
    settings.markModified('welcome');
    settings.markModified('economy');
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

      // أعِد تثبيت توكن REST دورياً — أي 401 عابر في @discordjs/rest يمسح
      // التوكن ويترك البوت متصلاً بالبوابة لكن كل طلبات REST معطّلة.
      this.startRestTokenGuard();

      // أوامر لوحة التحكم عن بعد (طابور عبر MongoDB)
      try {
        this.dashboardCommandWorker.start();
        logger.info('🖱️ Dashboard command worker started');
      } catch (e) {
        logger.warn('Dashboard command worker failed to start:', e);
      }

      logger.info('✅ Liberty City Bot initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  // --------------------------------------------
  // حماية توكن REST
  // --------------------------------------------
  // @discordjs/rest يمسح التوكن داخلياً عند أول استجابة 401، بينما تبقى بوابة
  // Discord متصلة — فتتعطّل كل طلبات REST حتى إعادة تشغيل البوت بالكامل.
  // إعادة تثبيت التوكن الحالي دورياً تجعل البوت يتعافى من أي 401 عابر.
  private startRestTokenGuard(): void {
    const apply = (): void => {
      if (this.token) this.rest.setToken(this.token);
    };
    apply();
    if (this.restTokenTimer) clearInterval(this.restTokenTimer);
    this.restTokenTimer = setInterval(apply, 90_000);
    this.restTokenTimer.unref?.();
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
  // تسجيل الأوامر عالمياً مرة واحدة (وليس لكل سيرفر)
  // --------------------------------------------
  async registerCommands(): Promise<void> {
    try {
      await this.commandHandler.registerCommands(
        config.discord.clientId,
        config.discord.token
      );
      logger.info('✅ Registered slash commands globally');
    } catch (error) {
      logger.error('Failed to register slash commands:', error);
      throw error;
    }
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

    if (this.restTokenTimer) {
      clearInterval(this.restTokenTimer);
      this.restTokenTimer = undefined;
    }

    this.protectionHandler.cleanup();
    this.ticketHandler.cleanup();
    this.loggingHandler.cleanup();
    this.activityTracker.cleanup();
    this.securityHandler.cleanup();
    this.levelingHandler.cleanup();
    this.aiInvestigator.cleanup();

    await mongoose.disconnect();
    logger.info('📦 Disconnected from MongoDB');

    this.destroy();
    logger.info('👋 Bot destroyed');
  }
}

export default LibertyClient;