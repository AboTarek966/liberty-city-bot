import mongoose, { Document } from 'mongoose';
export interface IAIResponseRule extends Document {
    guildId: string;
    name: string;
    trigger: string;
    response: string;
    roleId?: string;
    priority: number;
    enabled: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface IAIConfig extends Document {
    guildId: string;
    enabled: boolean;
    provider?: 'openai' | 'anthropic' | 'groq' | 'both' | 'auto';
    aiModel?: string;
    systemPrompt?: string;
    autoReplyOnMention: boolean;
    mentionChannels: string[];
    ignoredChannels: string[];
    ignoredRoles: string[];
    sensitiveKeywords: string[];
    customPersonality: string;
    responseRules: IAIResponseRule[];
    rolePersonalities: Record<string, string>;
    maxTokens: number;
    temperature: number;
    cooldown: number;
    language: 'ar' | 'en' | 'both';
    createdAt: Date;
    updatedAt: Date;
}
export declare const AIConfig: mongoose.Model<IAIConfig, {}, {}, {}, mongoose.Document<unknown, {}, IAIConfig, {}, {}> & IAIConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const AIResponseRule: mongoose.Model<IAIResponseRule, {}, {}, {}, mongoose.Document<unknown, {}, IAIResponseRule, {}, {}> & IAIResponseRule & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default AIConfig;
//# sourceMappingURL=AIConfig.d.ts.map