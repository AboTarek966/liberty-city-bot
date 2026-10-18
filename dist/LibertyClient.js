"use strict";
// ============================================
// Liberty City Bot - Main Client
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibertyClient = void 0;
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const helpers_1 = require("./utils/helpers");
const handlers_1 = require("./handlers");
const mongoose_1 = __importDefault(require("mongoose"));
const logger = (0, helpers_1.createLogger)('LibertyCity');
// --------------------------------------------
// Liberty Client Class
// --------------------------------------------
class LibertyClient extends discord_js_1.Client {
    // Handlers
    commandHandler;
    eventHandler;
    interactionHandler;
    aiHandler;
    protectionHandler;
    ticketHandler;
    moderationHandler;
    loggingHandler;
    activityTracker;
    securityHandler;
    levelingHandler;
    antiAltHandler;
    inviteTrackerHandler;
    messageScannerHandler;
    aiAutoModHandler;
    // Cooldowns
    cooldowns = new discord_js_1.Collection();
    // Cache
    guildSettingsCache = new discord_js_1.Collection();
    constructor() {
        super({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMembers,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.GuildModeration,
                discord_js_1.GatewayIntentBits.GuildVoiceStates,
                discord_js_1.GatewayIntentBits.GuildPresences,
                discord_js_1.GatewayIntentBits.GuildMessageReactions,
                discord_js_1.GatewayIntentBits.GuildInvites,
                discord_js_1.GatewayIntentBits.DirectMessages,
                discord_js_1.GatewayIntentBits.MessageContent,
            ],
            partials: [
                discord_js_1.Partials.Message,
                discord_js_1.Partials.Channel,
                discord_js_1.Partials.Reaction,
                discord_js_1.Partials.User,
                discord_js_1.Partials.GuildMember,
            ],
            allowedMentions: {
                parse: ['users', 'roles'],
                repliedUser: false,
            },
        });
        // Initialize handlers
        this.commandHandler = new handlers_1.CommandHandler(this);
        this.eventHandler = new handlers_1.EventHandler(this);
        this.interactionHandler = new handlers_1.InteractionHandler(this);
        this.aiHandler = new handlers_1.AIHandler(this);
        this.protectionHandler = new handlers_1.ProtectionHandler(this);
        this.ticketHandler = new handlers_1.TicketHandler(this);
        this.moderationHandler = new handlers_1.ModerationHandler(this);
        this.loggingHandler = new handlers_1.LoggingHandler(this);
        this.activityTracker = new handlers_1.ActivityTracker(this);
        this.securityHandler = new handlers_1.SecurityHandler(this);
        this.levelingHandler = new handlers_1.LevelingHandler(this);
        this.antiAltHandler = new handlers_1.AntiAltHandler(this);
        this.inviteTrackerHandler = new handlers_1.InviteTrackerHandler(this);
        this.messageScannerHandler = new handlers_1.MessageScannerHandler(config_1.config.apis.virustotal || process.env.VIRUSTOTAL_API_KEY);
        this.aiAutoModHandler = new handlers_1.AIAutoModHandler(this);
    }
    // --------------------------------------------
    // Initialize Bot
    // --------------------------------------------
    async initialize() {
        try {
            logger.info('🚀 Initializing Liberty City Bot...');
            // Validate configuration
            (0, config_1.validateConfig)();
            // Connect to MongoDB
            await this.connectDatabase();
            // Load handlers
            await this.loadHandlers();
            // Login to Discord
            await this.login(config_1.config.discord.token);
            logger.info('✅ Liberty City Bot initialized successfully');
        }
        catch (error) {
            logger.error('❌ Failed to initialize bot:', error);
            process.exit(1);
        }
    }
    // --------------------------------------------
    // Connect to Database
    // --------------------------------------------
    async connectDatabase() {
        try {
            await mongoose_1.default.connect(config_1.config.database.uri);
            logger.info('📦 Connected to MongoDB');
            // 🔄 مزامنة فهرس الاختصارات — فك الفهرس الفريد القديم ليسمح
            // باستخدام نفس الاختصار لأكثر من أمر (نظام التبديل/Toggle)
            try {
                const { CommandAlias } = await Promise.resolve().then(() => __importStar(require('./models')));
                await CommandAlias.collection.dropIndex('guildId_1_alias_1').catch(() => { });
                await CommandAlias.createIndexes().catch(() => { });
            }
            catch (e) {
                logger.warn(`Alias index sync skipped: ${e.message}`);
            }
        }
        catch (error) {
            logger.error('❌ Failed to connect to MongoDB:', error);
            throw error;
        }
    }
    // --------------------------------------------
    // Load Handlers
    // --------------------------------------------
    async loadHandlers() {
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
    async registerCommands() {
        const guildIds = Array.from(this.guilds.cache.keys());
        if (guildIds.length === 0) {
            // لا يوجد سيرفرات — سجّل عالمياً كاحتياط
            await this.commandHandler.registerCommands(config_1.config.discord.clientId, config_1.config.discord.token);
            return;
        }
        let ok = 0;
        for (const guildId of guildIds) {
            try {
                await this.commandHandler.registerCommands(config_1.config.discord.clientId, config_1.config.discord.token, guildId);
                ok++;
            }
            catch (error) {
                logger.warn(`Failed to register commands for guild ${guildId}:`, error);
            }
        }
        logger.info(`✅ Registered slash commands in ${ok}/${guildIds.length} server(s)`);
    }
    // تسجيل الأوامر في سيرفر واحد (يُستدعى عند انضمام سيرفر جديد)
    async registerCommandsForGuild(guildId) {
        await this.commandHandler.registerCommands(config_1.config.discord.clientId, config_1.config.discord.token, guildId);
    }
    // --------------------------------------------
    // Set Bot Status
    // --------------------------------------------
    setStatus() {
        const activities = [
            { name: 'Liberty City', type: discord_js_1.ActivityType.Playing },
            { name: 'حماية سيرفرك', type: discord_js_1.ActivityType.Watching },
            { name: 'المساعدة بالأوامر', type: discord_js_1.ActivityType.Listening },
            { name: 'أوامر /help', type: discord_js_1.ActivityType.Competing },
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
    async cleanup() {
        logger.info('🧹 Cleaning up...');
        this.protectionHandler.cleanup();
        this.ticketHandler.cleanup();
        this.loggingHandler.cleanup();
        this.activityTracker.cleanup();
        this.securityHandler.cleanup();
        this.levelingHandler.cleanup();
        await mongoose_1.default.disconnect();
        logger.info('📦 Disconnected from MongoDB');
        this.destroy();
        logger.info('👋 Bot destroyed');
    }
}
exports.LibertyClient = LibertyClient;
exports.default = LibertyClient;
//# sourceMappingURL=LibertyClient.js.map