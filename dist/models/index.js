"use strict";
// ============================================
// Liberty City Bot - Database Models
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupConfig = exports.LoggingConfig = exports.LeaveConfig = exports.WelcomeConfig = exports.LevelingConfig = exports.AutoModRule = exports.ModuleSetting = exports.Poll = exports.GameStats = exports.RogueBot = exports.InvestigationFinding = exports.InvestigationRun = exports.AIResponseRule = exports.AIConfig = exports.CommandAlias = exports.DashboardCommand = exports.UserAFK = exports.MuteRole = exports.UserProfile = exports.AISession = exports.Ticket = exports.JailData = exports.Warning = exports.ModerationCase = exports.GuildSettings = void 0;
exports.getGuildSettings = getGuildSettings;
exports.invalidateGuildSettings = invalidateGuildSettings;
exports.getOrCreateUserProfile = getOrCreateUserProfile;
exports.getNextCaseId = getNextCaseId;
const mongoose_1 = __importStar(require("mongoose"));
// Import new models
const CommandAlias_1 = require("./CommandAlias");
const AIConfig_1 = require("./AIConfig");
const GameStats_1 = require("./GameStats");
const Poll_1 = require("./Poll");
const AdvancedSettings_1 = require("./AdvancedSettings");
// --------------------------------------------
// Schemas
// --------------------------------------------
// Guild Settings Schema
const TicketOptionSchema = new mongoose_1.Schema({
    label: { type: String, required: true },
    description: { type: String },
    emoji: { type: String },
}, { _id: false });
const TicketFieldSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    placeholder: { type: String, required: true },
    style: { type: String, enum: ['short', 'paragraph'], required: true },
    required: { type: Boolean, default: false },
}, { _id: false });
const TicketPanelSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    emoji: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String },
    type: { type: String, enum: ['button', 'select'], required: true },
    fields: [TicketFieldSchema],
    options: [TicketOptionSchema],
    supportRoleIds: [{ type: String }],
    image: { type: String },
}, { _id: false });
const CustomCommandSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    content: { type: String, required: true },
    embed: { type: Boolean, default: false },
    // 🔒 نطاق الأمر: 'public' = للجميع · 'admin' = لحاملي Administrator فقط
    scope: { type: String, enum: ['public', 'admin'], default: 'public' },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    uses: { type: Number, default: 0 },
}, { _id: false });
const TagSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    uses: { type: Number, default: 0 },
}, { _id: false });
const ReactionRoleEntrySchema = new mongoose_1.Schema({
    emoji: { type: String, required: true },
    roleId: { type: String, required: true },
    type: { type: String, enum: ['unique', 'multiple'], default: 'multiple' },
}, { _id: false });
const ReactionRoleSchema = new mongoose_1.Schema({
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    roles: [ReactionRoleEntrySchema],
}, { _id: false });
const RoleMenuSchema = new mongoose_1.Schema({
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    title: { type: String, default: '' },
    roleIds: [{ type: String }],
}, { _id: false });
// مكافأة رول عند مستوى معيّن (يمكن أكثر من رول بنفس المستوى)
const LevelRewardSchema = new mongoose_1.Schema({
    level: { type: Number, required: true, min: 1 },
    roleId: { type: String, required: true },
}, { _id: false });
// عنصر متجر (شراء رول بالرصيد)
const ShopItemSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    roleId: { type: String, required: true },
    emoji: { type: String },
}, { _id: false });
const GuildSettingsSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    prefix: { type: String, default: 'lc!' },
    language: { type: String, default: 'ar' },
    timezone: { type: String, default: 'Asia/Riyadh' },
    settingsPassword: { type: String }, // كلمة مرور لوحة الإعدادات
    protection: {
        logChannel: { type: String },
        // 👑 موافقة المالك: أي "إطفاء" لحماية يحتاج نقرة مالك السيرفر (التاج) — مفعّل افتراضياً
        ownerApproval: { type: Boolean, default: true },
        antiRaid: {
            enabled: { type: Boolean, default: true },
            threshold: { type: Number, default: 5 },
            timeWindow: { type: Number, default: 60000 },
            action: { type: String, enum: ['kick', 'ban', 'lockdown'], default: 'kick' },
            logChannel: { type: String },
            beastMode: {
                enabled: { type: Boolean, default: true },
                minAccountAgeDays: { type: Number, default: 7 },
                requireAvatar: { type: Boolean, default: true },
                suspiciousJoinAction: { type: String, enum: ['kick', 'ban', 'none'], default: 'kick' },
                escalateVerification: { type: Boolean, default: true },
                autoRecoverMinutes: { type: Number, default: 15 },
            },
        },
        antiSpam: {
            enabled: { type: Boolean, default: true },
            maxMessages: { type: Number, default: 5 },
            timeWindow: { type: Number, default: 5000 },
            action: { type: String, enum: ['warn', 'mute', 'kick', 'ban'], default: 'mute' },
            muteDuration: { type: Number, default: 300000 },
            logChannel: { type: String },
        },
        antiLink: {
            enabled: { type: Boolean, default: true },
            whitelist: [{ type: String }],
            action: { type: String, enum: ['delete', 'warn', 'mute'], default: 'delete' },
            ignoreRoles: [{ type: String }],
            logChannel: { type: String },
        },
        antiInvite: {
            enabled: { type: Boolean, default: true },
            action: { type: String, enum: ['delete', 'warn', 'mute'], default: 'delete' },
            ignoreRoles: [{ type: String }],
            logChannel: { type: String },
        },
        antiMention: {
            enabled: { type: Boolean, default: true },
            max: { type: Number, default: 5 },
            action: { type: String, enum: ['delete', 'warn', 'mute'], default: 'mute' },
            logChannel: { type: String },
        },
        antiCaps: {
            enabled: { type: Boolean, default: true },
            minLength: { type: Number, default: 10 },
            percentage: { type: Number, default: 70 },
            action: { type: String, enum: ['delete', 'warn', 'mute'], default: 'delete' },
            logChannel: { type: String },
        },
        antiEmoji: {
            enabled: { type: Boolean, default: true },
            max: { type: Number, default: 10 },
            action: { type: String, enum: ['delete', 'warn', 'mute'], default: 'delete' },
            logChannel: { type: String },
        },
        antiNuke: {
            enabled: { type: Boolean, default: true },
            threshold: { type: Number, default: 1 },
            timeWindow: { type: Number, default: 10000 },
            action: { type: String, enum: ['alert', 'kick', 'ban', 'strip'], default: 'kick' },
            logChannel: { type: String },
            /** 🛡️ وضع الحماية: prevent = منع وقائي (حظر فوري + حجر الصلاحيات) | react = استجابة بحسب الإجراء المحدد */
            mode: { type: String, enum: ['prevent', 'react'], default: 'prevent' },
            /** ♻️ إعادة بنية السيرفر تلقائياً بعد هجوم حذف مكثف */
            autoRestore: { type: Boolean, default: true },
            /** 👢 إرسال رابط الدعوة للمطرودين تلقائياً (الطرد لا يُلغى في ديسكورد) */
            autoDmRecovery: { type: Boolean, default: true },
            /** 🐢 حارس النيوك البطيء (تراكمي) */
            slowNukeGuard: { type: Boolean, default: true },
            slowNukeMax: { type: Number, default: 6 },
            slowNukeWindowMinutes: { type: Number, default: 10 },
            /** 📋 رولات/قنوات مستثناة من مضاد النيوك (whitelist) */
            whitelistedRoles: [{ type: String }],
            whitelistedChannels: [{ type: String }],
        },
        antiBot: {
            enabled: { type: Boolean, default: true },
            whitelist: [{ type: String }],
            logChannel: { type: String },
        },
        antiAdmin: {
            enabled: { type: Boolean, default: true },
            action: { type: String, enum: ['alert', 'kick', 'ban'], default: 'kick' },
            logChannel: { type: String },
        },
        autoBackup: {
            enabled: { type: Boolean, default: true },
            interval: { type: Number, default: 6 },
            keep: { type: Number, default: 5 },
        },
        autoScan: {
            enabled: { type: Boolean, default: true },
            interval: { type: Number, default: 6 },
        },
        scamFilter: {
            enabled: { type: Boolean, default: true },
        },
        lockdown: { type: Boolean, default: false },
        antiAlt: {
            enabled: { type: Boolean, default: false },
            action: { type: String, enum: ['kick', 'ban', 'quarantine', 'log'], default: 'quarantine' },
            maxAccountsPerIP: { type: Number, default: 3 },
            checkCreationDays: { type: Number, default: 30 },
            quarantineRoleId: { type: String },
            logChannel: { type: String },
        },
        inviteTracker: {
            enabled: { type: Boolean, default: true },
            trackJoins: { type: Boolean, default: true },
            trackLeaves: { type: Boolean, default: true },
            suspiciousInviteAction: { type: String, enum: ['delete', 'warn', 'kick', 'ban'], default: 'warn' },
            minInviteAgeHours: { type: Number, default: 24 },
            maxUsesPerInvite: { type: Number, default: 100 },
            logChannel: { type: String },
            rewardRoleId: { type: String },
            rewardInvites: { type: Number, default: 5 },
        },
        messageScanner: {
            enabled: { type: Boolean, default: false },
            scanLinks: { type: Boolean, default: true },
            scanAttachments: { type: Boolean, default: true },
            virusTotalApiKey: { type: String },
            action: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'delete' },
            whitelistDomains: [{ type: String }],
            logChannel: { type: String },
        },
        aiAutoMod: {
            enabled: { type: Boolean, default: false },
            categories: {
                spam: { type: Boolean, default: true },
                toxicity: { type: Boolean, default: true },
                nsfw: { type: Boolean, default: true },
                scam: { type: Boolean, default: true },
                threat: { type: Boolean, default: true },
                pii: { type: Boolean, default: true },
                raid: { type: Boolean, default: true },
                selfharm: { type: Boolean, default: true },
            },
            sensitivity: { type: Number, default: 7 },
            actions: {
                spam: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'delete' },
                toxicity: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'warn' },
                nsfw: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'delete' },
                scam: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'ban' },
                threat: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'ban' },
                pii: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'delete' },
                raid: { type: String, enum: ['delete', 'warn', 'mute', 'ban'], default: 'mute' },
                selfharm: { type: String, enum: ['delete', 'warn', 'mute', 'ban', 'resources'], default: 'resources' },
            },
            muteDuration: { type: Number, default: 10 },
            ignoredChannels: [{ type: String }],
            ignoredRoles: [{ type: String }],
            logChannel: { type: String },
            escalation: { type: Boolean, default: true },
            maxWarningsBeforeEscalation: { type: Number, default: 3 },
        },
        aiTicketAssistant: {
            enabled: { type: Boolean, default: false },
            autoClaim: { type: Boolean, default: false },
            analyzeOnCreate: { type: Boolean, default: true },
            requireAdminApprovalForRoles: { type: Boolean, default: true },
            requireAdminApprovalForPermissions: { type: Boolean, default: true },
            requireAdminApprovalForBans: { type: Boolean, default: true },
            maxAutoActionsPerTicket: { type: Number, default: 3 },
            confidenceThreshold: { type: Number, default: 70 },
            notifyAdminsOnFailure: { type: Boolean, default: true },
            logChannel: { type: String },
        },
        aiTranslator: {
            enabled: { type: Boolean, default: false },
            defaultTargetLang: { type: String, default: 'ar' },
            autoTranslateChannels: [{ type: String }],
            ignoredChannels: [{ type: String }],
            ignoredRoles: [{ type: String }],
            showOriginal: { type: Boolean, default: true },
            maxLength: { type: Number, default: 2000 },
            logChannel: { type: String },
        },
        whitelist: {
            enabled: { type: Boolean, default: false },
            userIds: [{ type: String }],
            logChannel: { type: String },
        },
        announcements: {
            history: [{
                    type: { type: String, enum: ['dm', 'channel'] },
                    content: { type: String },
                    at: { type: Date, default: Date.now },
                    sentBy: { type: String },
                    sent: { type: Boolean, default: false },
                }],
        },
    },
    // 🎵 نظام الموسيقى — top-level (تقرأه MusicHandler ولوحة الإعدادات)
    music: {
        enabled: { type: Boolean, default: true },
        defaultVolume: { type: Number, default: 100 },
        maxQueueSize: { type: Number, default: 50 },
        allowDJ: { type: Boolean, default: false },
        djRoleId: { type: String },
        autoplay: { type: Boolean, default: false },
        restrictToChannels: [{ type: String }],
    },
    tickets: {
        categoryId: { type: String },
        logChannelId: { type: String },
        transcriptChannelId: { type: String },
        supportRoleIds: [{ type: String }],
        maxPerUser: { type: Number, default: 3 },
        autoCloseHours: { type: Number, default: 24 },
        panels: [TicketPanelSchema],
        autoMessageEnabled: { type: Boolean, default: false },
        autoMessage: {
            type: String,
            default: '🎫 تم فتح تذكرتك رقم **{ticket}**!\nفريق الدعم سيرد عليك في أقرب وقت — صف مشكلتك بوضوح لتسريع الرد 💬',
        },
        counter: { type: Number, default: 0 },
        surveyEnabled: { type: Boolean, default: true },
        adminRoleIds: { type: [String], default: [] },
        lockUntilClaim: { type: Boolean, default: false },
        welcomeEnabled: { type: Boolean, default: false },
        claimStats: { type: Map, of: Number, default: {} },
        claimLog: {
            type: [{ _id: false, userId: { type: String }, at: { type: Date } }],
            default: [],
        },
    },
    logging: {
        enabled: { type: Boolean, default: true },
        channelId: { type: String },
        types: [{ type: String }],
        channels: { type: mongoose_1.Schema.Types.Mixed, default: {} },
        ignoredChannels: [{ type: String }],
        ignoredRoles: [{ type: String }],
    },
    // 🕵️ سنايب (استرجاع الرسائل المحذوفة)
    snipe: {
        enabled: { type: Boolean, default: true },
    },
    welcome: {
        enabled: { type: Boolean, default: true },
        channelId: { type: String },
        message: { type: String, default: 'مرحباً {user}! أهلاً بك في **{server}**. أنت العضو رقم {count} 🎉' },
        dmEnabled: { type: Boolean, default: false },
        dmMessage: { type: String, default: 'مرحباً بك في {server}! نتمنى لك وقتاً ممتعاً.' },
        imageEnabled: { type: Boolean, default: true },
        imageBackground: { type: String },
        embedColor: { type: String, default: '#00D4FF' },
        embedTitle: { type: String, default: 'مرحباً بك!' },
        embedThumbnail: { type: String },
        // 🖼️ بطاقة مخصصة (مساحة الرسم 800×300 — الإحداثيات من مركز كل عنصر)
        card: {
            enabled: { type: Boolean, default: false },
            backgroundUrl: { type: String },
            avatarX: { type: Number, default: 130 },
            avatarY: { type: Number, default: 150 },
            avatarSize: { type: Number, default: 170 },
            nameX: { type: Number, default: 350 },
            nameY: { type: Number, default: 130 },
            nameSize: { type: Number, default: 52 },
            nameColor: { type: String, default: '#FFFFFF' },
            countX: { type: Number, default: 350 },
            countY: { type: Number, default: 195 },
            countSize: { type: Number, default: 28 },
            countColor: { type: String, default: '#C7CED8' },
        },
    },
    leave: {
        enabled: { type: Boolean, default: true },
        channelId: { type: String },
        message: { type: String, default: '{user} غادر السيرفر. أصبح عدد الأعضاء {count} 😢' },
        embedColor: { type: String, default: '#FF3366' },
    },
    jail: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String }, // روم السجن
        jailRoleId: { type: String }, // رول السجن
    },
    automod: {
        enabled: { type: Boolean, default: true },
        badWords: [{ type: String }],
        badWordsAction: { type: String, enum: ['delete', 'warn', 'mute', 'kick', 'ban'], default: 'mute' },
        badWordsDuration: { type: Number, default: 600000 },
        zalgoEnabled: { type: Boolean, default: true },
        zalgoAction: { type: String, enum: ['delete', 'warn', 'mute'], default: 'delete' },
        ignoredRoles: [{ type: String }],
        ignoredChannels: [{ type: String }],
    },
    economy: {
        enabled: { type: Boolean, default: true },
        currency: { type: String, default: 'عملة' },
        currencySymbol: { type: String, default: '💰' },
        dailyAmount: { type: Number, default: 500 },
        workAmount: { min: { type: Number, default: 100 }, max: { type: Number, default: 500 } },
        begAmount: { min: { type: Number, default: 10 }, max: { type: Number, default: 100 } },
        robEnabled: { type: Boolean, default: true },
        robCooldown: { type: Number, default: 3600000 },
        slotsEnabled: { type: Boolean, default: true },
        blackjackEnabled: { type: Boolean, default: true },
        // Bank system
        bankEnabled: { type: Boolean, default: true },
        bankInterestRate: { type: Number, default: 0.5 },
        bankMaxDeposit: { type: Number, default: 1000000 },
        // Shop system
        shopEnabled: { type: Boolean, default: true },
        shopItems: [{ type: 'Mixed' }],
        // Transfers
        transferEnabled: { type: Boolean, default: true },
        transferTax: { type: Number, default: 5 },
        transferCooldown: { type: Number, default: 3600000 },
        // Voice rewards
        voiceRewardsEnabled: { type: Boolean, default: true },
        voiceRewardPerMinute: { type: Number, default: 5 },
        voiceRewardInterval: { type: Number, default: 60000 },
        // Daily/Weekly/Monthly rewards
        weeklyAmount: { type: Number, default: 2000 },
        monthlyAmount: { type: Number, default: 10000 },
        // Gambling
        coinflipEnabled: { type: Boolean, default: true },
        diceEnabled: { type: Boolean, default: true },
        // Inventory
        inventoryEnabled: { type: Boolean, default: true },
        // Leaderboard
        leaderboardEnabled: { type: Boolean, default: true },
    },
    leveling: {
        enabled: { type: Boolean, default: true },
        xpPerMessage: { type: Number, default: 15 },
        xpCooldown: { type: Number, default: 60000 },
        levelUpChannelId: { type: String },
        levelUpMessage: { type: String, default: 'تهانينا {user}! لقد وصلت للمستوى {level} 🎉' },
        levelRoles: { type: Map, of: String },
        levelRewards: [LevelRewardSchema],
        levelUpStyle: { type: String, enum: ['text', 'embed'], default: 'embed' },
        levelUpTitle: { type: String, default: '🎉 ترقية جديدة!' },
        levelUpColor: { type: String, default: '#e67e22' },
        xpGainMultiplier: { type: Number, default: 1 },
        voiceXpPerMinute: { type: Number, default: 10 },
        ignoredChannels: [{ type: String }],
        ignoredRoles: [{ type: String }],
    },
    ai: {
        enabled: { type: Boolean, default: true },
        provider: { type: String, enum: ['openai', 'anthropic', 'both'], default: 'openai' },
        model: { type: String, default: 'gpt-4-turbo-preview' },
        systemPrompt: { type: String, default: 'أنت مساعد ذكي لبوت Liberty City. أنت ودود، مفيد، وتتكلم العربية بطلاقة.' },
        temperature: { type: Number, default: 0.7 },
        maxTokens: { type: Number, default: 2000 },
        cooldown: { type: Number, default: 3000 },
        allowedChannels: [{ type: String }],
        allowedRoles: [{ type: String }],
        ignoredChannels: [{ type: String }],
        ignoredRoles: [{ type: String }],
        responseLanguage: { type: String, default: 'ar' },
    },
    // 🕵️ AI Investigator — افتراضياً مفعّل، تحليل فقط بدون أي عقوبات تلقائية
    aiInvestigator: {
        enabled: { type: Boolean, default: true },
        automatic: { type: Boolean, default: true },
        scanOnStartup: { type: Boolean, default: true },
        intervalHours: { type: Number, default: 6, min: 1, max: 168 },
        alertChannelId: { type: String },
        minSeverityToAlert: {
            type: String,
            enum: ['info', 'low', 'medium', 'high', 'critical'],
            default: 'high',
        },
        includeMessages: { type: Boolean, default: true },
        messageLookbackHours: { type: Number, default: 48, min: 1, max: 720 },
        maxMessagesPerChannel: { type: Number, default: 25, min: 5, max: 100 },
        maxTextChannels: { type: Number, default: 30, min: 5, max: 100 },
        maxMembers: { type: Number, default: 1200, min: 100, max: 5000 },
        maxFindings: { type: Number, default: 40, min: 5, max: 100 },
        autoResolveDays: { type: Number, default: 30, min: 1, max: 365 },
        ignoredChannelIds: [{ type: String }],
    },
    customCommands: [CustomCommandSchema],
    tags: [TagSchema],
    reactionRoles: [ReactionRoleSchema],
    autorole: {
        enabled: { type: Boolean, default: false },
        roleId: { type: String },
    },
    roleMenus: [RoleMenuSchema],
    verification: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String },
        roleId: { type: String },
        title: { type: String, default: '✅ توثيق العضوية' },
        description: {
            type: String,
            default: 'اضغط الزر بالأسفل للحصول على رتبة العضو والقدرة على التفاعل في السيرفر',
        },
        buttonLabel: { type: String, default: 'توثيق' },
        buttonEmoji: { type: String, default: '✅' },
    },
    shop: {
        enabled: { type: Boolean, default: true },
        items: [ShopItemSchema],
    },
    warnRoles: {
        memberIds: [{ type: String }],
        adminIds: [{ type: String }],
        adminSequential: {
            role1Id: { type: String, default: '' },
            role2Id: { type: String, default: '' },
            role3Id: { type: String, default: '' },
        },
    },
    updatedAt: { type: Date, default: Date.now },
});
// Moderation Case Schema
const ModerationCaseSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    caseId: { type: Number, required: true },
    type: { type: String, enum: ['ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'timeout', 'untimeout', 'softban', 'note', 'role_add', 'role_remove'], required: true },
    moderatorId: { type: String, required: true },
    targetId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    duration: { type: Number },
    expiresAt: { type: Date },
    proof: { type: String },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
ModerationCaseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
// Warning Schema
const WarningSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    caseId: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
});
// Jail Data Schema
const JailDataSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    previousRoles: [{ type: String }],
    jailRoleId: { type: String, required: true },
    jailedBy: { type: String, required: true },
    reason: { type: String, required: true },
    jailedAt: { type: Date, default: Date.now },
    duration: { type: Number }, // ms, null = دائم
    jailChannelId: { type: String, required: true },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
JailDataSchema.index({ guildId: 1, userId: 1 }, { unique: true });
// Ticket Schema
const TicketFieldResponseSchema = new mongoose_1.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
}, { _id: false });
// لقطة صلاحيات قناة التذكرة قبل تطبيق القفل (لإعادتها كما كانت)
const TicketLockSnapshotSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    allow: { type: String, required: true },
    deny: { type: String, required: true },
    existed: { type: Boolean, default: true },
}, { _id: false });
const TicketSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    panelId: { type: String },
    status: { type: String, enum: ['open', 'claimed', 'waiting', 'closed', 'deleted'], default: 'open' },
    claimedBy: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    subject: { type: String },
    fields: [TicketFieldResponseSchema],
    transcript: { type: String },
    closedBy: { type: String },
    closeReason: { type: String },
    locked: { type: Boolean, default: false },
    lockGrantedUsers: [{ type: String }],
    /** سجل الإداريين الذين استلموا هذه التذكرة — لعدم احتساب نقاط مكررة */
    claimHistory: [{ type: String }],
    lockSnapshots: [TicketLockSnapshotSchema],
    closeSnapshots: [TicketLockSnapshotSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now },
    idleWarned: { type: Boolean, default: false },
});
// AI Session Schema
const AIMessageSchema = new mongoose_1.Schema({
    role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });
const AISessionSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, index: true },
    channelId: { type: String },
    messages: [AIMessageSchema],
    lastActivity: { type: Date, default: Date.now },
    tokenCount: { type: Number, default: 0 },
});
// User Profile Schema
const InventoryItemSchema = new mongoose_1.Schema({
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    usable: { type: Boolean, default: false },
    roleId: { type: String },
}, { _id: false });
const UserProfileSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    balance: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    totalXp: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    voiceTime: { type: Number, default: 0 },
    lastDaily: { type: Date },
    lastWork: { type: Date },
    lastBeg: { type: Date },
    lastRob: { type: Date },
    inventory: [InventoryItemSchema],
    badges: [{ type: String }],
    reputation: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
UserProfileSchema.index({ userId: 1, guildId: 1 }, { unique: true });
// Mute Role Schema
const MuteRoleSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    roleId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});
const UserAFKSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    reason: { type: String, default: 'AFK' },
    since: { type: Date, default: Date.now },
});
UserAFKSchema.index({ guildId: 1, userId: 1 }, { unique: true });
const DashboardCommandSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    command: { type: String, required: true },
    payload: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending', index: true },
    result: { type: mongoose_1.Schema.Types.Mixed, default: null },
    error: { type: String },
    createdAt: { type: Date, default: Date.now, expires: 86400 },
    updatedAt: { type: Date, default: Date.now },
});
// --------------------------------------------
// Model Exports
// --------------------------------------------
exports.GuildSettings = mongoose_1.default.model('GuildSettings', GuildSettingsSchema);
exports.ModerationCase = mongoose_1.default.model('ModerationCase', ModerationCaseSchema);
exports.Warning = mongoose_1.default.model('Warning', WarningSchema);
exports.JailData = mongoose_1.default.model('JailData', JailDataSchema);
exports.Ticket = mongoose_1.default.model('Ticket', TicketSchema);
exports.AISession = mongoose_1.default.model('AISession', AISessionSchema);
exports.UserProfile = mongoose_1.default.model('UserProfile', UserProfileSchema);
exports.MuteRole = mongoose_1.default.model('MuteRole', MuteRoleSchema);
exports.UserAFK = mongoose_1.default.model('UserAFK', UserAFKSchema);
exports.DashboardCommand = mongoose_1.default.model('DashboardCommand', DashboardCommandSchema);
// Re-export new models
var CommandAlias_2 = require("./CommandAlias");
Object.defineProperty(exports, "CommandAlias", { enumerable: true, get: function () { return CommandAlias_2.CommandAlias; } });
var AIConfig_2 = require("./AIConfig");
Object.defineProperty(exports, "AIConfig", { enumerable: true, get: function () { return AIConfig_2.AIConfig; } });
Object.defineProperty(exports, "AIResponseRule", { enumerable: true, get: function () { return AIConfig_2.AIResponseRule; } });
var AIInvestigation_1 = require("./AIInvestigation");
Object.defineProperty(exports, "InvestigationRun", { enumerable: true, get: function () { return AIInvestigation_1.InvestigationRun; } });
Object.defineProperty(exports, "InvestigationFinding", { enumerable: true, get: function () { return AIInvestigation_1.InvestigationFinding; } });
var RogueBot_1 = require("./RogueBot");
Object.defineProperty(exports, "RogueBot", { enumerable: true, get: function () { return RogueBot_1.RogueBot; } });
var GameStats_2 = require("./GameStats");
Object.defineProperty(exports, "GameStats", { enumerable: true, get: function () { return GameStats_2.GameStats; } });
var Poll_2 = require("./Poll");
Object.defineProperty(exports, "Poll", { enumerable: true, get: function () { return Poll_2.Poll; } });
var AdvancedSettings_2 = require("./AdvancedSettings");
Object.defineProperty(exports, "ModuleSetting", { enumerable: true, get: function () { return AdvancedSettings_2.ModuleSetting; } });
Object.defineProperty(exports, "AutoModRule", { enumerable: true, get: function () { return AdvancedSettings_2.AutoModRule; } });
Object.defineProperty(exports, "LevelingConfig", { enumerable: true, get: function () { return AdvancedSettings_2.LevelingConfig; } });
Object.defineProperty(exports, "WelcomeConfig", { enumerable: true, get: function () { return AdvancedSettings_2.WelcomeConfig; } });
Object.defineProperty(exports, "LeaveConfig", { enumerable: true, get: function () { return AdvancedSettings_2.LeaveConfig; } });
Object.defineProperty(exports, "LoggingConfig", { enumerable: true, get: function () { return AdvancedSettings_2.LoggingConfig; } });
Object.defineProperty(exports, "BackupConfig", { enumerable: true, get: function () { return AdvancedSettings_2.BackupConfig; } });
// --------------------------------------------
// Helper Functions
// --------------------------------------------
// ⚡ ذاكرة مؤقتة لإعدادات السيرفر — تسرّع كل التفاعلات والأوامر
// (تُستخدم نفس الوثيقة للمدة الصالحة — التعديلات والحفظ تعمل كالمعتاد)
const settingsCache = new Map();
const SETTINGS_CACHE_TTL_MS = 30_000;
// 🛡️ منع سباق إنشاء الإعدادات: عدة استدعاءات متزامنة لنفس السيرفر
// كانت تنشئ وثيقتين في نفس اللحظة → E11000 duplicate key
const settingsLoading = new Map();
async function loadGuildSettings(guildId) {
    // upsert ذرّي: لا يرمي خطأ لو وُجدت الوثيقة بالفعل
    try {
        const settings = await exports.GuildSettings.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        if (settings)
            return settings;
    }
    catch (error) {
        // سباق نادر بين عمليتي upsert — نقرأ الوثيقة الموجودة
        if (error?.code !== 11000)
            throw error;
    }
    const existing = await exports.GuildSettings.findOne({ guildId });
    if (existing)
        return existing;
    // احتياط أخير (لو فشل الـupsert لأي سبب)
    try {
        return await exports.GuildSettings.create({ guildId });
    }
    catch (error) {
        if (error?.code === 11000) {
            const again = await exports.GuildSettings.findOne({ guildId });
            if (again)
                return again;
        }
        throw error;
    }
}
async function getGuildSettings(guildId) {
    const hit = settingsCache.get(guildId);
    if (hit && Date.now() - hit.ts < SETTINGS_CACHE_TTL_MS)
        return hit.doc;
    const pending = settingsLoading.get(guildId);
    if (pending)
        return pending;
    const load = loadGuildSettings(guildId);
    settingsLoading.set(guildId, load);
    try {
        const settings = await load;
        settingsCache.set(guildId, { doc: settings, ts: Date.now() });
        return settings;
    }
    finally {
        settingsLoading.delete(guildId);
    }
}
/** إجبار إعادة الجلب من قاعدة البيانات (بعد تعديل خارجي مباشر) */
function invalidateGuildSettings(guildId) {
    settingsCache.delete(guildId);
}
async function getOrCreateUserProfile(userId, guildId) {
    try {
        const profile = await exports.UserProfile.findOneAndUpdate({ userId, guildId }, { $setOnInsert: { userId, guildId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        if (profile)
            return profile;
    }
    catch (error) {
        if (error?.code !== 11000)
            throw error;
    }
    const existing = await exports.UserProfile.findOne({ userId, guildId });
    if (existing)
        return existing;
    try {
        return await exports.UserProfile.create({ userId, guildId });
    }
    catch (error) {
        if (error?.code === 11000) {
            const again = await exports.UserProfile.findOne({ userId, guildId });
            if (again)
                return again;
        }
        throw error;
    }
}
async function getNextCaseId(guildId) {
    const lastCase = await exports.ModerationCase.findOne({ guildId }).sort({ caseId: -1 });
    return (lastCase?.caseId || 0) + 1;
}
exports.default = {
    GuildSettings: exports.GuildSettings,
    ModerationCase: exports.ModerationCase,
    Warning: exports.Warning,
    Ticket: exports.Ticket,
    AISession: exports.AISession,
    UserProfile: exports.UserProfile,
    MuteRole: exports.MuteRole,
    CommandAlias: CommandAlias_1.CommandAlias,
    AIConfig: AIConfig_1.AIConfig,
    AIResponseRule: AIConfig_1.AIResponseRule,
    GameStats: GameStats_1.GameStats,
    Poll: Poll_1.Poll,
    ModuleSetting: AdvancedSettings_1.ModuleSetting,
    AutoModRule: AdvancedSettings_1.AutoModRule,
    LevelingConfig: AdvancedSettings_1.LevelingConfig,
    WelcomeConfig: AdvancedSettings_1.WelcomeConfig,
    LeaveConfig: AdvancedSettings_1.LeaveConfig,
    LoggingConfig: AdvancedSettings_1.LoggingConfig,
    BackupConfig: AdvancedSettings_1.BackupConfig,
    getGuildSettings,
    getOrCreateUserProfile,
    getNextCaseId,
};
//# sourceMappingURL=index.js.map