"use strict";
// ============================================
// Liberty City Bot - Advanced Settings Model
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
exports.BackupConfig = exports.LoggingConfig = exports.LeaveConfig = exports.WelcomeConfig = exports.LevelingConfig = exports.AutoModRule = exports.ModuleSetting = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ModuleSettingSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    module: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    config: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: false, updatedAt: true } });
ModuleSettingSchema.index({ guildId: 1, module: 1 }, { unique: true });
const AutoModRuleSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['link', 'invite', 'word', 'spam', 'caps', 'emoji', 'mention', 'attachment'], required: true },
    action: { type: String, enum: ['delete', 'warn', 'timeout', 'mute', 'kick', 'ban', 'log'], required: true },
    config: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
}, { timestamps: true });
const LevelingConfigSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    xpPerMessage: { min: { type: Number, default: 15 }, max: { type: Number, default: 25 } },
    xpCooldown: { type: Number, default: 60 },
    voiceXpPerMinute: { type: Number, default: 10 },
    ignoredChannels: [{ type: String }],
    ignoredRoles: [{ type: String }],
    levelUpChannel: { type: String },
    levelUpMessage: { type: String, default: '🎉 مبروك {user}! وصلت للمستوى {level}!' },
    roles: [{ level: Number, roleId: String }],
    blacklistedUsers: [{ type: String }],
});
const WelcomeConfigSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String },
    message: { type: String, default: 'أهلاً بك {user} في {server}! 🎉' },
    embed: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: 'مرحباً بك!' },
        description: { type: String, default: '{user} انضم إلينا! نحن الآن {count} أعضاء 🎉' },
        color: { type: String, default: '#00D4FF' },
        thumbnail: { type: Boolean, default: true },
        image: { type: String },
        footer: { type: String, default: 'Liberty City Bot' },
    },
    dmEnabled: { type: Boolean, default: false },
    dmMessage: { type: String, default: 'أهلاً بك في {server}! استمتع بإقامتك 🎉' },
    roles: [{ type: String }],
});
const LeaveConfigSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String },
    message: { type: String, default: '{user} غادر السيرفر. وداعاً! 👋' },
    embed: {
        enabled: { type: Boolean, default: true },
        title: { type: String, default: 'وداعاً!' },
        description: { type: String, default: '{user} غادر السيرفر. نتمنى له التوفيق 👋' },
        color: { type: String, default: '#FF3366' },
    },
});
const LoggingConfigSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String },
    events: {
        messageDelete: Boolean,
        messageEdit: Boolean,
        memberJoin: Boolean,
        memberLeave: Boolean,
        memberBan: Boolean,
        memberUnban: Boolean,
        memberUpdate: Boolean,
        roleCreate: Boolean,
        roleDelete: Boolean,
        roleUpdate: Boolean,
        channelCreate: Boolean,
        channelDelete: Boolean,
        channelUpdate: Boolean,
        voiceStateUpdate: Boolean,
        inviteCreate: Boolean,
        inviteDelete: Boolean,
        webhookUpdate: Boolean,
        integrationUpdate: Boolean,
        threadCreate: Boolean,
        threadDelete: Boolean,
        threadUpdate: Boolean,
    },
});
const BackupConfigSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    interval: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
    channelId: { type: String },
    include: {
        roles: { type: Boolean, default: true },
        channels: { type: Boolean, default: true },
        permissions: { type: Boolean, default: true },
        settings: { type: Boolean, default: true },
        bans: { type: Boolean, default: true },
    },
    lastBackup: { type: Date },
    backups: [{
            date: { type: Date, default: Date.now },
            data: mongoose_1.Schema.Types.Mixed,
            size: Number,
        }],
});
exports.ModuleSetting = mongoose_1.default.model('ModuleSetting', ModuleSettingSchema);
exports.AutoModRule = mongoose_1.default.model('AutoModRule', AutoModRuleSchema);
exports.LevelingConfig = mongoose_1.default.model('LevelingConfig', LevelingConfigSchema);
exports.WelcomeConfig = mongoose_1.default.model('WelcomeConfig', WelcomeConfigSchema);
exports.LeaveConfig = mongoose_1.default.model('LeaveConfig', LeaveConfigSchema);
exports.LoggingConfig = mongoose_1.default.model('LoggingConfig', LoggingConfigSchema);
exports.BackupConfig = mongoose_1.default.model('BackupConfig', BackupConfigSchema);
exports.default = {
    ModuleSetting: exports.ModuleSetting,
    AutoModRule: exports.AutoModRule,
    LevelingConfig: exports.LevelingConfig,
    WelcomeConfig: exports.WelcomeConfig,
    LeaveConfig: exports.LeaveConfig,
    LoggingConfig: exports.LoggingConfig,
    BackupConfig: exports.BackupConfig,
};
//# sourceMappingURL=AdvancedSettings.js.map