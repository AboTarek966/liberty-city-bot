"use strict";
// ============================================
// Omni Bot - Main Client
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
exports.OmniClient = void 0;
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const helpers_1 = require("./utils/helpers");
const handlers_1 = require("./handlers");
const mongoose_1 = __importDefault(require("mongoose"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger = (0, helpers_1.createLogger)('Omni');
// --------------------------------------------
// Omni Client Class
// --------------------------------------------
class OmniClient extends discord_js_1.Client {
    // Handlers
    commandHandler;
    eventHandler;
    interactionHandler;
    aiHandler;
    aiInvestigator;
    protectionHandler;
    ticketHandler;
    moderationHandler;
    loggingHandler;
    activityTracker;
    securityHandler;
    levelingHandler;
    antiAltHandler;
    inviteTrackerHandler;
    returnTrackerHandler;
    messageScannerHandler;
    aiAutoModHandler;
    aiTicketAssistant;
    aiTranslator;
    economyHandler;
    gameHandler;
    musicHandler;
    voiceKeeperHandler;
    dashboardCommandWorker;
    webDashboard;
    // Express server for Dashboard API
    expressApp;
    // مؤقّت إعادة تثبيت توكن REST (يُمسح تلقائياً عند أي 401 في @discordjs/rest)
    restTokenTimer;
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
        // Initialize Express app
        this.expressApp = (0, express_1.default)();
        // لوحة التحكم المدمجة — تُنشأ قبل setupExpress حتى يتمكن من تركيب حارس /api
        this.webDashboard = new handlers_1.WebDashboard(this);
        this.setupExpress();
        // Initialize handlers
        this.commandHandler = new handlers_1.CommandHandler(this);
        this.eventHandler = new handlers_1.EventHandler(this);
        this.interactionHandler = new handlers_1.InteractionHandler(this);
        this.aiHandler = new handlers_1.AIHandler(this);
        this.aiInvestigator = new handlers_1.AIInvestigator(this);
        this.protectionHandler = new handlers_1.ProtectionHandler(this);
        this.ticketHandler = new handlers_1.TicketHandler(this);
        this.moderationHandler = new handlers_1.ModerationHandler(this);
        this.loggingHandler = new handlers_1.LoggingHandler(this);
        this.activityTracker = new handlers_1.ActivityTracker(this);
        this.securityHandler = new handlers_1.SecurityHandler(this);
        this.levelingHandler = new handlers_1.LevelingHandler(this);
        this.antiAltHandler = new handlers_1.AntiAltHandler(this);
        this.inviteTrackerHandler = new handlers_1.InviteTrackerHandler(this);
        this.returnTrackerHandler = new handlers_1.ReturnTrackerHandler(this);
        this.messageScannerHandler = new handlers_1.MessageScannerHandler(config_1.config.apis.virustotal || process.env.VIRUSTOTAL_API_KEY);
        this.aiAutoModHandler = new handlers_1.AIAutoModHandler(this);
        this.aiTicketAssistant = new handlers_1.AITicketAssistant(this);
        this.aiTranslator = new handlers_1.AITranslator(this);
        this.economyHandler = new handlers_1.EconomyHandler(this);
        this.gameHandler = new handlers_1.GameHandler(this);
        this.musicHandler = new handlers_1.MusicHandler(this);
        this.voiceKeeperHandler = new handlers_1.VoiceKeeperHandler(this);
        this.dashboardCommandWorker = new handlers_1.DashboardCommandWorker(this);
    }
    setupExpress() {
        this.expressApp.use((0, cors_1.default)({
            origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
            credentials: true,
        }));
        this.expressApp.use(express_1.default.json());
        // Health check
        this.expressApp.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
        // API Routes
        this.setupApiRoutes();
        // 🖥️ لوحة التحكم المدمجة (صفحة + أصول + مصادقة) — تُخدم من نفس المنفذ العام
        try {
            this.webDashboard.attach(this.expressApp);
        }
        catch (e) {
            logger.warn(`⚠️ Web dashboard attach failed: ${e?.message || e}`);
        }
    }
    setupApiRoutes() {
        const router = express_1.default.Router();
        // Guild settings
        router.get('/guilds/:guildId/settings', async (req, res) => {
            try {
                const guildId = req.params.guildId;
                const settings = await this.getGuildSettings(guildId);
                res.json(settings);
            }
            catch (error) {
                logger.error('Failed to get guild settings:', error);
                res.status(500).json({ error: 'Failed to get settings' });
            }
        });
        router.patch('/guilds/:guildId/settings', async (req, res) => {
            try {
                const guildId = req.params.guildId;
                const updates = req.body;
                const settings = await this.updateGuildSettings(guildId, updates);
                res.json(settings);
            }
            catch (error) {
                logger.error('Failed to update guild settings:', error);
                res.status(500).json({ error: 'Failed to update settings' });
            }
        });
        // Guild roles (for the members-page role manager)
        router.get('/guilds/:guildId/roles', async (req, res) => {
            try {
                const guild = this.guilds.cache.get(req.params.guildId);
                if (!guild)
                    return res.status(404).json({ error: 'Guild not found' });
                const roles = guild.roles.cache
                    .filter(r => r.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }));
                res.json(roles);
            }
            catch (error) {
                logger.error('Failed to get guild roles:', error);
                res.status(500).json({ error: 'Failed to get roles' });
            }
        });
        // Guild stats
        router.get('/guilds/:guildId/stats', async (req, res) => {
            try {
                const guildId = req.params.guildId;
                const stats = await this.getGuildStats(guildId);
                res.json(stats);
            }
            catch (error) {
                logger.error('Failed to get guild stats:', error);
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
        // Dashboard stats
        router.get('/dashboard/stats', async (req, res) => {
            try {
                const stats = await this.getDashboardStats();
                res.json(stats);
            }
            catch (error) {
                logger.error('Failed to get dashboard stats:', error);
                res.status(500).json({ error: 'Failed to get stats' });
            }
        });
        // Guild tickets
        router.get('/guilds/:guildId/tickets', async (req, res) => {
            try {
                const { Ticket } = await Promise.resolve().then(() => __importStar(require('./models')));
                const tickets = await Ticket.find({ guildId: req.params.guildId })
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .lean();
                res.json(tickets);
            }
            catch (error) {
                logger.error('Failed to get tickets:', error);
                res.status(500).json({ error: 'Failed to get tickets' });
            }
        });
        router.post('/guilds/:guildId/tickets/:ticketId/claim', async (req, res) => {
            try {
                const { Ticket } = await Promise.resolve().then(() => __importStar(require('./models')));
                const ticket = await Ticket.findOneAndUpdate({ channelId: req.params.ticketId, guildId: req.params.guildId }, { status: 'claimed', claimedBy: req.body.claimedBy, claimHistory: { $concatArrays: ['$claimHistory', [req.body.claimedBy]] } }, { new: true });
                if (!ticket)
                    return res.status(404).json({ error: 'Ticket not found' });
                res.json(ticket);
            }
            catch (error) {
                logger.error('Failed to claim ticket:', error);
                res.status(500).json({ error: 'Failed to claim ticket' });
            }
        });
        router.post('/guilds/:guildId/tickets/:ticketId/close', async (req, res) => {
            try {
                const { Ticket } = await Promise.resolve().then(() => __importStar(require('./models')));
                const ticket = await Ticket.findOneAndUpdate({ channelId: req.params.ticketId, guildId: req.params.guildId }, { status: 'closed', closedBy: req.body.closedBy, closeReason: req.body.reason, closedAt: new Date() }, { new: true });
                if (!ticket)
                    return res.status(404).json({ error: 'Ticket not found' });
                res.json(ticket);
            }
            catch (error) {
                logger.error('Failed to close ticket:', error);
                res.status(500).json({ error: 'Failed to close ticket' });
            }
        });
        // Guild members
        router.get('/guilds/:guildId/members', async (req, res) => {
            try {
                const guild = this.guilds.cache.get(req.params.guildId);
                if (!guild)
                    return res.status(404).json({ error: 'Guild not found' });
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
            }
            catch (error) {
                logger.error('Failed to get members:', error);
                res.status(500).json({ error: 'Failed to get members' });
            }
        });
        router.post('/guilds/:guildId/members/:memberId/warn', async (req, res) => {
            try {
                const { ModerationCase, getNextCaseId } = await Promise.resolve().then(() => __importStar(require('./models')));
                const guild = this.guilds.cache.get(req.params.guildId);
                if (!guild)
                    return res.status(404).json({ error: 'Guild not found' });
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
            }
            catch (error) {
                logger.error('Failed to warn member:', error);
                res.status(500).json({ error: 'Failed to warn member' });
            }
        });
        router.post('/guilds/:guildId/members/:memberId/kick', async (req, res) => {
            try {
                const { ModerationCase, getNextCaseId } = await Promise.resolve().then(() => __importStar(require('./models')));
                const guild = this.guilds.cache.get(req.params.guildId);
                if (!guild)
                    return res.status(404).json({ error: 'Guild not found' });
                const member = await guild.members.fetch(req.params.memberId).catch(() => null);
                if (!member)
                    return res.status(404).json({ error: 'Member not found' });
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
            }
            catch (error) {
                logger.error('Failed to kick member:', error);
                res.status(500).json({ error: 'Failed to kick member' });
            }
        });
        router.post('/guilds/:guildId/members/:memberId/ban', async (req, res) => {
            try {
                const { ModerationCase, getNextCaseId } = await Promise.resolve().then(() => __importStar(require('./models')));
                const guild = this.guilds.cache.get(req.params.guildId);
                if (!guild)
                    return res.status(404).json({ error: 'Guild not found' });
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
            }
            catch (error) {
                logger.error('Failed to ban member:', error);
                res.status(500).json({ error: 'Failed to ban member' });
            }
        });
        // Guild logs
        router.get('/guilds/:guildId/logs', async (req, res) => {
            try {
                const { ModerationCase } = await Promise.resolve().then(() => __importStar(require('./models')));
                const { type, userId, limit = 50, page = 1 } = req.query;
                const query = { guildId: req.params.guildId };
                if (type)
                    query.type = type;
                if (userId)
                    query.targetId = userId;
                const logs = await ModerationCase.find(query)
                    .sort({ createdAt: -1 })
                    .skip((Number(page) - 1) * Number(limit))
                    .limit(Number(limit))
                    .lean();
                const total = await ModerationCase.countDocuments(query);
                res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
            }
            catch (error) {
                logger.error('Failed to get logs:', error);
                res.status(500).json({ error: 'Failed to get logs' });
            }
        });
        // Guild economy
        router.get('/guilds/:guildId/economy', async (req, res) => {
            try {
                const { UserProfile } = await Promise.resolve().then(() => __importStar(require('./models')));
                const users = await UserProfile.find({ guildId: req.params.guildId })
                    .sort({ balance: -1 })
                    .limit(50)
                    .lean();
                res.json(users);
            }
            catch (error) {
                logger.error('Failed to get economy:', error);
                res.status(500).json({ error: 'Failed to get economy' });
            }
        });
        router.post('/guilds/:guildId/economy/give', async (req, res) => {
            try {
                const { UserProfile, getOrCreateUserProfile } = await Promise.resolve().then(() => __importStar(require('./models')));
                const { userId, amount, type = 'balance' } = req.body;
                const profile = await getOrCreateUserProfile(userId, req.params.guildId);
                profile[type] = (profile[type] || 0) + Number(amount);
                await profile.save();
                res.json(profile);
            }
            catch (error) {
                logger.error('Failed to give economy:', error);
                res.status(500).json({ error: 'Failed to give economy' });
            }
        });
        router.post('/guilds/:guildId/economy/reset', async (req, res) => {
            try {
                const { UserProfile } = await Promise.resolve().then(() => __importStar(require('./models')));
                await UserProfile.deleteMany({ guildId: req.params.guildId });
                res.json({ success: true });
            }
            catch (error) {
                logger.error('Failed to reset economy:', error);
                res.status(500).json({ error: 'Failed to reset economy' });
            }
        });
        // Guild shop
        router.get('/guilds/:guildId/shop', async (req, res) => {
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
                const settings = await getGuildSettings(req.params.guildId);
                res.json(settings.shop?.items || []);
            }
            catch (error) {
                logger.error('Failed to get shop:', error);
                res.status(500).json({ error: 'Failed to get shop' });
            }
        });
        router.post('/guilds/:guildId/shop', async (req, res) => {
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
                const settings = await getGuildSettings(req.params.guildId);
                settings.shop = settings.shop || { enabled: true, items: [] };
                settings.shop.items.push(req.body);
                await settings.save();
                res.json(settings.shop.items);
            }
            catch (error) {
                logger.error('Failed to add shop item:', error);
                res.status(500).json({ error: 'Failed to add shop item' });
            }
        });
        router.delete('/guilds/:guildId/shop/:itemId', async (req, res) => {
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
                const settings = await getGuildSettings(req.params.guildId);
                settings.shop.items = settings.shop.items.filter((i) => i.id !== req.params.itemId);
                await settings.save();
                res.json(settings.shop.items);
            }
            catch (error) {
                logger.error('Failed to delete shop item:', error);
                res.status(500).json({ error: 'Failed to delete shop item' });
            }
        });
        // Welcome messages
        router.get('/guilds/:guildId/welcome', async (req, res) => {
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
                const settings = await getGuildSettings(req.params.guildId);
                res.json(settings.welcome || {});
            }
            catch (error) {
                logger.error('Failed to get welcome:', error);
                res.status(500).json({ error: 'Failed to get welcome' });
            }
        });
        // Protection features
        router.post('/guilds/:guildId/protection/:feature', async (req, res) => {
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
                const settings = await getGuildSettings(req.params.guildId);
                const feature = req.params.feature;
                const prot = settings.protection;
                if (prot[feature]) {
                    prot[feature].enabled = req.body.enabled;
                    await settings.save();
                    res.json(prot[feature]);
                }
                else {
                    res.status(404).json({ error: 'Feature not found' });
                }
            }
            catch (error) {
                logger.error('Failed to update protection:', error);
                res.status(500).json({ error: 'Failed to update protection' });
            }
        });
        // AI features
        router.post('/guilds/:guildId/ai/:feature', async (req, res) => {
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
                const settings = await getGuildSettings(req.params.guildId);
                const feature = req.params.feature;
                const prot = settings.protection;
                if (prot[feature]) {
                    prot[feature].enabled = req.body.enabled;
                    Object.assign(prot[feature], req.body.config || {});
                    await settings.save();
                    res.json(prot[feature]);
                }
                else {
                    res.status(404).json({ error: 'Feature not found' });
                }
            }
            catch (error) {
                logger.error('Failed to update AI:', error);
                res.status(500).json({ error: 'Failed to update AI' });
            }
        });
        // Bot leave guild
        router.post('/guilds/:guildId/leave', async (req, res) => {
            try {
                const guild = this.guilds.cache.get(req.params.guildId);
                if (!guild)
                    return res.status(404).json({ error: 'Guild not found' });
                await guild.leave();
                res.json({ success: true });
            }
            catch (error) {
                logger.error('Failed to leave guild:', error);
                res.status(500).json({ error: 'Failed to leave guild' });
            }
        });
        // ===== 🖥️ واجهات لوحة التحكم المدمجة =====
        // معلومات البوت (نظرة عامة)
        router.get('/bot/info', async (_req, res) => {
            try {
                res.json({
                    user: this.user
                        ? { id: this.user.id, tag: this.user.tag, avatar: this.user.displayAvatarURL() }
                        : null,
                    uptimeSeconds: Math.floor((this.uptime || 0) / 1000),
                    ping: Math.round(this.ws.ping),
                    guilds: this.guilds.cache.size,
                    users: this.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0),
                    channels: this.guilds.cache.reduce((a, g) => a + g.channels.cache.size, 0),
                    memoryMB: Math.round(process.memoryUsage().rss / 1048576),
                    commands: this.commandHandler?.commands?.size || 0,
                });
            }
            catch (error) {
                logger.error('Failed to get bot info:', error);
                res.status(500).json({ error: 'Failed to get bot info' });
            }
        });
        // قنوات السيرفر (للقوائم المنسدلة)
        router.get('/guilds/:guildId/channels', async (req, res) => {
            try {
                const guild = this.guilds.cache.get(req.params.guildId);
                if (!guild)
                    return res.status(404).json({ error: 'Guild not found' });
                const channels = Array.from(guild.channels.cache.values())
                    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
                    .map((c) => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId || null }));
                res.json({ channels });
            }
            catch (error) {
                logger.error('Failed to get channels:', error);
                res.status(500).json({ error: 'Failed to get channels' });
            }
        });
        // ===== 📚 قاعدة المعرفة =====
        router.get('/guilds/:guildId/knowledge', async (req, res) => {
            try {
                const { KnowledgeEntry } = await Promise.resolve().then(() => __importStar(require('./models')));
                const entries = await KnowledgeEntry.find({ guildId: req.params.guildId })
                    .sort({ updatedAt: -1 })
                    .limit(200)
                    .lean();
                res.json({ entries });
            }
            catch (error) {
                logger.error('Failed to get knowledge:', error);
                res.status(500).json({ error: 'Failed to get knowledge' });
            }
        });
        router.post('/guilds/:guildId/knowledge', async (req, res) => {
            try {
                const { KnowledgeEntry } = await Promise.resolve().then(() => __importStar(require('./models')));
                const { title, content, tags, category } = req.body || {};
                if (!String(title || '').trim() || !String(content || '').trim()) {
                    return res.status(400).json({ error: 'العنوان والمحتوى مطلوبان' });
                }
                const actor = req.webAuth?.username || req.webAuth?.userId || 'لوحة التحكم';
                const tagList = Array.isArray(tags)
                    ? tags
                    : String(tags || '')
                        .split(',');
                const entry = await KnowledgeEntry.create({
                    guildId: req.params.guildId,
                    title: String(title).trim().slice(0, 200),
                    content: String(content).trim().slice(0, 8000),
                    tags: tagList
                        .map((t) => String(t).toLowerCase().trim())
                        .filter(Boolean)
                        .slice(0, 15),
                    category: String(category || 'عام').trim().slice(0, 50),
                    createdBy: actor,
                    enabled: true,
                });
                res.json({ entry });
            }
            catch (error) {
                logger.error('Failed to create knowledge:', error);
                res.status(500).json({ error: 'Failed to create knowledge' });
            }
        });
        router.delete('/guilds/:guildId/knowledge/:entryId', async (req, res) => {
            try {
                const { KnowledgeEntry } = await Promise.resolve().then(() => __importStar(require('./models')));
                await KnowledgeEntry.deleteOne({ _id: req.params.entryId, guildId: req.params.guildId });
                res.json({ success: true });
            }
            catch (error) {
                logger.error('Failed to delete knowledge:', error);
                res.status(500).json({ error: 'Failed to delete knowledge' });
            }
        });
        // ===== 🎛️ جسر أوامر اللوحة (تنفيذ فوري داخل نفس العملية) =====
        const DASHBOARD_ALLOWED_COMMANDS = new Set([
            'members_list', 'roles_list', 'member_get', 'member_warn', 'member_kick',
            'member_ban', 'member_timeout', 'member_addrole', 'member_removerole',
            'ticket_claim', 'ticket_unclaim', 'ticket_close', 'ticket_delete', 'ticket_reply',
            'ping', 'guild_stats', 'channels_list', 'welcome_test', 'broadcast', 'settings_sync',
        ]);
        router.post('/guilds/:guildId/command', async (req, res) => {
            try {
                const { command, payload } = req.body || {};
                if (!command || !DASHBOARD_ALLOWED_COMMANDS.has(String(command))) {
                    return res.status(400).json({ error: 'أمر غير مسموح' });
                }
                const actor = req.webAuth?.username || req.webAuth?.userId || 'لوحة التحكم';
                const result = await this.dashboardCommandWorker.executeNow(String(command), req.params.guildId, { ...(payload || {}), actor: payload?.actor || actor });
                res.json({ success: true, result: result ?? null });
            }
            catch (error) {
                res.status(500).json({ error: error?.message || 'فشل تنفيذ الأمر' });
            }
        });
        // 🛡️ حراسة كل مسارات /api — لا وصول بدون جلسة داشبورد أو مفتاح خدمة
        this.expressApp.use('/api', this.webDashboard.apiGuard());
        this.expressApp.use('/api', router);
    }
    async getGuildSettings(guildId) {
        const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
        const settings = await getGuildSettings(guildId);
        return settings.toObject();
    }
    /**
     * طابور حفظ متسلسل لكل سيرفر — يمنع تشغيل save() متوازي على نفس وثيقة
     * Mongoose (الذي يرمي "Can't save() the same doc multiple times in parallel"
     * عند ضغط مفاتيح متعددة بسرعة من اللوحة).
     */
    settingsUpdateQueue = new Map();
    updateGuildSettings(guildId, updates) {
        const prev = this.settingsUpdateQueue.get(guildId) || Promise.resolve();
        const next = prev
            .catch(() => undefined)
            .then(() => this.applyGuildSettingsUpdate(guildId, updates));
        // خزّن السلسلة مع كتم الأخطاء حتى لا تتعطل التحديثات التالية
        this.settingsUpdateQueue.set(guildId, next.catch(() => undefined));
        return next;
    }
    async applyGuildSettingsUpdate(guildId, updates) {
        const { getGuildSettings, invalidateGuildSettings, GuildSettings } = await Promise.resolve().then(() => __importStar(require('./models')));
        const settings = await getGuildSettings(guildId);
        // دمج عميق حقيقي — أي مسار (حتى 4+ مستويات) يُحدَّث بدون مسح الأشقاء
        const deepMerge = (target, patch, depth = 0) => {
            if (depth > 10)
                return;
            for (const [key, value] of Object.entries(patch)) {
                if (key.startsWith('$'))
                    continue;
                const current = target[key];
                if (value &&
                    typeof value === 'object' &&
                    !Array.isArray(value) &&
                    current &&
                    typeof current === 'object' &&
                    !Array.isArray(current) &&
                    !(current instanceof Date)) {
                    deepMerge(current, value, depth + 1);
                }
                else {
                    target[key] = value;
                }
            }
        };
        try {
            deepMerge(settings, updates);
            for (const key of Object.keys(updates)) {
                if (!key.startsWith('$'))
                    settings.markModified(key);
            }
            await settings.save();
            invalidateGuildSettings(guildId);
            return settings.toObject();
        }
        catch (error) {
            // إعادة محاولة واحدة بوثيقة نظيفة (تغطي أي تعارض خارجي على نفس الوثيقة)
            logger.warn(`settings save retry for ${guildId}: ${error?.message || error}`);
            invalidateGuildSettings(guildId);
            const fresh = await GuildSettings.findOne({ guildId });
            if (!fresh)
                throw error;
            deepMerge(fresh, updates);
            for (const key of Object.keys(updates)) {
                if (!key.startsWith('$'))
                    fresh.markModified(key);
            }
            await fresh.save();
            invalidateGuildSettings(guildId);
            return fresh.toObject();
        }
    }
    async getGuildStats(guildId) {
        const guild = this.guilds.cache.get(guildId);
        if (!guild)
            return { error: 'Guild not found' };
        return {
            memberCount: guild.memberCount,
            channelCount: guild.channels.cache.size,
            roleCount: guild.roles.cache.size,
            onlineCount: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
        };
    }
    async getDashboardStats() {
        return {
            totalGuilds: this.guilds.cache.size,
            totalUsers: this.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0),
            totalChannels: this.guilds.cache.reduce((acc, g) => acc + g.channels.cache.size, 0),
        };
    }
    // --------------------------------------------
    // Initialize Bot
    // --------------------------------------------
    async initialize() {
        try {
            logger.info('🚀 Initializing Omni Bot...');
            // Validate configuration
            (0, config_1.validateConfig)();
            // Connect to MongoDB
            await this.connectDatabase();
            // Load handlers
            await this.loadHandlers();
            // Login to Discord
            await this.login(config_1.config.discord.token);
            // أعِد تثبيت توكن REST دورياً — أي 401 عابر في @discordjs/rest يمسح
            // التوكن ويترك البوت متصلاً بالبوابة لكن كل طلبات REST معطّلة.
            this.startRestTokenGuard();
            // أوامر لوحة التحكم عن بعد (طابور عبر MongoDB)
            try {
                this.dashboardCommandWorker.start();
                logger.info('🖱️ Dashboard command worker started');
            }
            catch (e) {
                logger.warn('Dashboard command worker failed to start:', e);
            }
            logger.info('✅ Omni Bot initialized successfully');
        }
        catch (error) {
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
    startRestTokenGuard() {
        const apply = () => {
            if (this.token)
                this.rest.setToken(this.token);
        };
        apply();
        if (this.restTokenTimer)
            clearInterval(this.restTokenTimer);
        this.restTokenTimer = setInterval(apply, 90_000);
        this.restTokenTimer.unref?.();
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
    // تسجيل الأوامر عالمياً مرة واحدة (وليس لكل سيرفر)
    // --------------------------------------------
    async registerCommands() {
        try {
            await this.commandHandler.registerCommands(config_1.config.discord.clientId, config_1.config.discord.token);
            logger.info('✅ Registered slash commands globally');
        }
        catch (error) {
            logger.error('Failed to register slash commands:', error);
            throw error;
        }
    }
    // --------------------------------------------
    // Set Bot Status
    // --------------------------------------------
    setStatus() {
        const activities = [
            { name: 'Omni', type: discord_js_1.ActivityType.Playing },
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
        await mongoose_1.default.disconnect();
        logger.info('📦 Disconnected from MongoDB');
        this.destroy();
        logger.info('👋 Bot destroyed');
    }
}
exports.OmniClient = OmniClient;
exports.default = OmniClient;
//# sourceMappingURL=OmniClient.js.map