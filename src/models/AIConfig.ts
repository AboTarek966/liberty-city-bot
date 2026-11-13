// ============================================
// Omni Bot - AI Configuration Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IAIResponseRule extends Document {
  guildId: string;
  name: string;
  trigger: string;           // كلمات مفتاحية أو نمط
  response: string;          // الرد المخصص
  roleId?: string;           // للرول المحدد (اختياري)
  priority: number;          // أولوية القاعدة
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAIConfig extends Document {
  guildId: string;
  enabled: boolean;
  provider?: 'openai' | 'anthropic' | 'groq' | 'gemini' | 'openrouter' | 'requesty' | 'custom' | 'both' | 'auto';
  aiModel?: string;
  systemPrompt?: string;
  autoReplyOnMention: boolean;      // رد تلقائي عند المنشن
  mentionChannels: string[];        // قنوات محددة (فارغ = جميع القنوات)
  allowedChannels: string[];        // قنوات مسموح بها (فارغ = الكل)
  allowedRoles: string[];           // رولات مسموح لها (فارغ = الكل)
  ignoredChannels: string[];        // قنوات متجاهلة
  ignoredRoles: string[];           // رولات متجاهلة
  sensitiveKeywords: string[];      // كلمات حساسة لا يرد عليها
  customPersonality: string;        // شخصية مخصصة
  responseRules: IAIResponseRule[]; // قواعد رد مخصصة
  rolePersonalities: Record<string, string>; // شخصية لكل رول
  /** 🔌 مزوّد API خارجي متوافق مع OpenAI (أي مزوّد: OpenAI/OpenRouterx/Groq/Together/...) — يُضاف من لوحة الإعدادات */
  customProvider?: {
    enabled: boolean;
    label: string;
    baseURL: string;
    apiKey: string;
    model: string;
  } | null;
  maxTokens: number;
  temperature: number;
  cooldown: number;                 // كولداون بين الردود (ثانية)
  language: 'ar' | 'en' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

const AIResponseRuleSchema = new Schema<IAIResponseRule>({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  trigger: { type: String, required: true },
  response: { type: String, required: true },
  roleId: { type: String },
  priority: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });

const AIConfigSchema = new Schema<IAIConfig>({
  guildId: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: true },
  provider: { type: String, enum: ['openai', 'anthropic', 'groq', 'gemini', 'openrouter', 'requesty', 'custom', 'both', 'auto'], default: 'auto' },
  aiModel: { type: String, default: '' },
  systemPrompt: { type: String, default: '' },
  autoReplyOnMention: { type: Boolean, default: true },
  mentionChannels: [{ type: String }],
  allowedChannels: [{ type: String }],
  allowedRoles: [{ type: String }],
  ignoredChannels: [{ type: String }],
  ignoredRoles: [{ type: String }],
  sensitiveKeywords: [{ type: String }],
  customPersonality: { type: String, default: '' },
  responseRules: [AIResponseRuleSchema],
  rolePersonalities: { type: Schema.Types.Mixed, default: {} },
  customProvider: {
    type: new Schema({
      enabled: { type: Boolean, default: false },
      label: { type: String, default: '' },
      baseURL: { type: String, default: '' },
      apiKey: { type: String, default: '' },
      model: { type: String, default: '' },
    }, { _id: false }),
    default: null,
  },
  maxTokens: { type: Number, default: 1600, min: 100, max: 8000 },
  temperature: { type: Number, default: 0.7 },
  cooldown: { type: Number, default: 3 },
  language: { type: String, enum: ['ar', 'en', 'both'], default: 'ar' },
}, { timestamps: true });

export const AIConfig = mongoose.model<IAIConfig>('AIConfig', AIConfigSchema);
export const AIResponseRule = mongoose.model<IAIResponseRule>('AIResponseRule', AIResponseRuleSchema);
export default AIConfig;