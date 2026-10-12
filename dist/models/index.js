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
exports.BackupConfig = exports.LoggingConfig = exports.LeaveConfig = exports.WelcomeConfig = exports.LevelingConfig = exports.AutoModRule = exports.ModuleSetting = exports.Poll = exports.GameStats = exports.AIResponseRule = exports.AIConfig = exports.CommandAlias = exports.UserAFK = exports.MuteRole = exports.UserProfile = exports.AISession = exports.Ticket = exports.JailData = exports.Warning = exports.ModerationCase = exports.GuildSettings = void 0;
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
        antiRaid: {
            enabled: { type: Boolean, default: true },
            threshold: { type: Number, default: 5 },
            timeWindow: { type: Number, default: 60000 },
            action: { type: String, enum: ['kick', 'ban', 'lockdown'], default: 'kick' },
            logChannel: { type: String },
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
            threshold: { type: Number, default: 3 },
            timeWindow: { type: Number, default: 10000 },
            action: { type: String, enum: ['alert', 'kick', 'ban'], default: 'kick' },
            logChannel: { type: String },
        },
        antiBot: {
            enabled: { type: Boolean, default: false },
            whitelist: [{ type: String }],
            logChannel: { type: String },
        },
        antiAdmin: {
            enabled: { type: Boolean, default: true },
            action: { type: String, enum: ['alert', 'kick'], default: 'alert' },
            logChannel: { type: String },
        },
        autoBackup: {
            enabled: { type: Boolean, default: true },
            interval: { type: Number, default: 6 },
            keep: { type: Number, default: 5 },
        },
        scamFilter: {
            enabled: { type: Boolean, default: true },
        },
        lockdown: { type: Boolean, default: false },
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
// Re-export new models
var CommandAlias_2 = require("./CommandAlias");
Object.defineProperty(exports, "CommandAlias", { enumerable: true, get: function () { return CommandAlias_2.CommandAlias; } });
var AIConfig_2 = require("./AIConfig");
Object.defineProperty(exports, "AIConfig", { enumerable: true, get: function () { return AIConfig_2.AIConfig; } });
Object.defineProperty(exports, "AIResponseRule", { enumerable: true, get: function () { return AIConfig_2.AIResponseRule; } });
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
async function getGuildSettings(guildId) {
    const hit = settingsCache.get(guildId);
    if (hit && Date.now() - hit.ts < SETTINGS_CACHE_TTL_MS)
        return hit.doc;
    let settings = await exports.GuildSettings.findOne({ guildId });
    if (!settings) {
        settings = await exports.GuildSettings.create({ guildId });
    }
    settingsCache.set(guildId, { doc: settings, ts: Date.now() });
    return settings;
}
/** إجبار إعادة الجلب من قاعدة البيانات (بعد تعديل خارجي مباشر) */
function invalidateGuildSettings(guildId) {
    settingsCache.delete(guildId);
}
async function getOrCreateUserProfile(userId, guildId) {
    let profile = await exports.UserProfile.findOne({ userId, guildId });
    if (!profile) {
        profile = await exports.UserProfile.create({ userId, guildId });
    }
    return profile;
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