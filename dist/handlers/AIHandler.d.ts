import { Client } from 'discord.js';
export interface AIResponse {
    content: string;
    tokensUsed: number;
    model: string;
    fallback: boolean;
}
export interface AIUserContext {
    username: string;
    isPrivileged: boolean;
    roleNames: string[];
}
/**
 * معالجات البث المباشر — تُستدعى أثناء توليد الرد
 * لعرض النص فور وصوله (إحساس سرعة أعلى).
 */
export interface AIStreamHandlers {
    onFirstChunk: (text: string) => void | Promise<void>;
    onUpdate?: (text: string) => void | Promise<void>;
}
export declare class AIHandler {
    private client;
    private openai;
    private anthropic;
    private groq;
    private cooldowns;
    private fallbackResponses;
    constructor(client: Client);
    private initializeProviders;
    private loadFallbackResponses;
    generateResponse(userId: string, guildId: string | undefined, channelId: string, message: string, userRoles?: string[], isMention?: boolean, repliedToBot?: boolean, opts?: {
        fromCommand?: boolean;
        userContext?: AIUserContext;
        stream?: AIStreamHandlers;
    }): Promise<AIResponse | null>;
    /**
     * Detects if an AI response is just (a near copy of) the user's question.
     */
    private isEchoResponse;
    /**
     * إزالة تكرار السؤال من بداية الرد.
     * يحذف أي سطر في أول الرد يعيد صياغة سؤال المستخدم حرفياً أو تقريباً
     * (مثل: "سؤالك: ..." / "أنت تسأل عن ..." / إعادة السؤال كاملاً كسطر أول).
     */
    private stripQuestionEcho;
    private checkCustomRules;
    private checkTrigger;
    private shouldAutoReply;
    private needsWebSearch;
    private generateAIResponse;
    private loadHistory;
    private saveHistory;
    /** بناء رسائل الـ API: system + ذاكرة المحادثة + سؤال المستخدم */
    private buildMessages;
    /**
     * Resolve the order in which AI providers should be tried.
     * Uses aiConfig.provider if set, otherwise AI_PROVIDER from .env (default: auto).
     * Any available provider not in the preferred list is appended as failover.
     */
    private resolveProviderOrder;
    private buildSystemPrompt;
    private generateOpenAI;
    private generateGroq;
    /** بث رد Groq مباشرة أثناء التوليد */
    private streamGroq;
    private generateAnthropic;
    private containsSensitiveContent;
    private getFallbackResponse;
    handleAICommand(interaction: any, prompt: string, options?: {
        model?: string;
        temperature?: number;
        maxTokens?: number;
        ephemeral?: boolean;
    }): Promise<void>;
    getConfig(guildId: string): Promise<import("mongoose").Document<unknown, {}, import("../models/AIConfig").IAIConfig, {}, {}> & import("../models/AIConfig").IAIConfig & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    updateConfig(guildId: string, data: Partial<any>): Promise<import("mongoose").Document<unknown, {}, import("../models/AIConfig").IAIConfig, {}, {}> & import("../models/AIConfig").IAIConfig & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    addResponseRule(guildId: string, rule: {
        name: string;
        trigger: string;
        response: string;
        roleId?: string;
        priority?: number;
        createdBy: string;
    }): Promise<import("../models/AIConfig").IAIResponseRule>;
    removeResponseRule(guildId: string, ruleId: string): Promise<void>;
    setRolePersonality(guildId: string, roleId: string, personality: string): Promise<void>;
    removeRolePersonality(guildId: string, roleId: string): Promise<void>;
    isAvailable(): boolean;
    getProviders(): string[];
    clearCooldown(userId: string, guildId?: string): void;
    checkCooldown(userId: string, guildId?: string): {
        onCooldown: boolean;
        remaining: number;
    };
    setCooldown(userId: string, guildId?: string): void;
    clearHistory(userId: string, guildId: string, channelId: string): Promise<void>;
    getProviderInfo(): {
        provider: string;
        model: string;
        openaiAvailable: boolean;
        anthropicAvailable: boolean;
        groqAvailable?: boolean;
    };
    getSessionInfo(userId: string, guildId: string, channelId: string): Promise<{
        messageCount: number;
    }>;
}
export default AIHandler;
//# sourceMappingURL=AIHandler.d.ts.map