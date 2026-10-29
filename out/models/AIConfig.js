"use strict";
// ============================================
// Liberty City Bot - AI Configuration Model
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
exports.AIResponseRule = exports.AIConfig = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AIResponseRuleSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    trigger: { type: String, required: true },
    response: { type: String, required: true },
    roleId: { type: String },
    priority: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
}, { timestamps: true });
const AIConfigSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    provider: { type: String, enum: ['openai', 'anthropic', 'groq', 'both', 'auto'], default: 'auto' },
    aiModel: { type: String, default: '' },
    systemPrompt: { type: String, default: '' },
    autoReplyOnMention: { type: Boolean, default: true },
    mentionChannels: [{ type: String }],
    ignoredChannels: [{ type: String }],
    ignoredRoles: [{ type: String }],
    sensitiveKeywords: [{ type: String }],
    customPersonality: { type: String, default: '' },
    responseRules: [AIResponseRuleSchema],
    rolePersonalities: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    maxTokens: { type: Number, default: 500 },
    temperature: { type: Number, default: 0.7 },
    cooldown: { type: Number, default: 3 },
    language: { type: String, enum: ['ar', 'en', 'both'], default: 'ar' },
}, { timestamps: true });
exports.AIConfig = mongoose_1.default.model('AIConfig', AIConfigSchema);
exports.AIResponseRule = mongoose_1.default.model('AIResponseRule', AIResponseRuleSchema);
exports.default = exports.AIConfig;
//# sourceMappingURL=AIConfig.js.map