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
    /** 🎯 العضو المستهدف في الرسالة الحالية (منشن أو رد) — يُستخدم تلقائياً للعقوبات/الرولات */
    targetUserId?: string;
    targetName?: string;
    targetSource?: 'mention' | 'reply';
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
    /** Gemini لا يحتاج SDK — نتحقق فقط من وجود المفتاح (الوحيد المدعوم للرؤية) */
    private geminiReady;
    /** OpenRouter — بديل مجاني يدعم الرؤية عبر موديلات :free */
    private openrouter;
    /** Requesty — بوابة مجانية (200 طلب/يوم · 20 RPM · بدون بطاقة) */
    private requesty;
    /** 🔌 مزوّدو API خارجية خاصة (متوافقة مع OpenAI) — يُبنى عميل لكل إعدادات سيرفر، يُحدَّث تلقائياً عند تغييرها */
    private customClients;
    /** مفتاح إنشاء عميل Custom لكل (guild + baseURL + model) — تتجدد تلقائياً عند تغيير الإعدادات */
    private customClientKey;
    private getCustomClient;
    private cooldowns;
    /** ⏳ تهدئة المزوّدين — المزوّد الذي فشل (مفتاح ميت/حصة/ازدحام) نتخطاه مؤقتاً بدل إهدار ثوانٍ كل رسالة */
    private providerCooldowns;
    private fallbackResponses;
    constructor(client: Client);
    private initializeProviders;
    private loadFallbackResponses;
    generateResponse(userId: string, guildId: string | undefined, channelId: string, message: string, userRoles?: string[], isMention?: boolean, repliedToBot?: boolean, opts?: {
        fromCommand?: boolean;
        userContext?: AIUserContext;
        stream?: AIStreamHandlers;
        safeMode?: boolean;
        /** 🔌 تجاهل مفتاح الذكاء العام — للميزات المستقلة مثل مساعد التذاكر */
        ignoreGlobalToggle?: boolean;
        /** ✂️ ردود قصيرة للذكاء العام — تُلغى تلقائياً إذا طلب المستخدم التفصيل */
        brief?: boolean;
        /** وسائط الرسالة (صور/رسائل صوتية/فيديو/ملفات) — تُحلَّل قبل التوليد */
        attachments?: Array<{
            id: string;
            name?: string | null;
            url: string;
            contentType?: string | null;
            size?: number | null;
            duration?: number | null;
            flags?: number | null;
            height?: number | null;
            width?: number | null;
        }>;
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
    /**
     * هل طلب المستخدم تفصيلاً صريحاً؟ — يُلغي وضع الاختصار للذكاء العام.
     * الطلب الصريح للاختصار يتقدّم على أي كلمة أخرى.
     */
    private wantsDetailedAnswer;
    private needsWebSearch;
    private generateAIResponse;
    /** كشف نداء الأداة في رد النموذج: [[SEARCH: استعلام]] أو [[FETCH: رابط]] */
    private extractToolCall;
    /** فهرس أسماء الأدوات الفعلية (lowercase → الاسم المسجّل) */
    private toolNameIndex;
    /** ترجمة اسم الأداة لاسم مسجّل فعلاً — أي JSON عادي لا يُعدّ استدعاء أداة */
    private normalizeToolName;
    /** كشف كل نداءات الأدوات في الرد — يدعم كتلة واحدة أو عدة كتل/مصفوفة/أدوات متعددة */
    private extractActionCalls;
    /** أول نداء أداة فقط — للتوافق مع المسارات القديمة */
    private extractActionCall;
    /** تجميع نص {…} متوازن بدءاً من startIdx */
    private findBalancedJson;
    /** تحويل كائن JSON إلى نداء أداة صالح — يرفض أي اسم غير مسجّل في السجل */
    private parseActionValue;
    private parseActionCallJson;
    /** هل نص المستخدم أمر تنفيذي (تغيير/إنشاء/حذف...) وليس مجرد سؤال؟ */
    private looksLikeActionRequest;
    /** سؤال عن قدرات البوت/الأدوات → يكفي ضمّ [ACTIONS] القصيرة بدل إلغائها */
    private looksLikeCapabilityQuestion;
    /** رسالة إجبار النموذج على إخراج استدعاء أداة واحد فقط بعد ردّ ادّعى التنفيذ بلا أداة */
    private buildForceToolPrompt;
    /** تنفيذ أداة البحث/الجلب وإرجاع نص النتيجة أو نص فشل مُعلَّم */
    private runResearchTool;
    private loadHistory;
    private maybeUpdateSummary;
    private saveHistory;
    /** بناء رسائل الـ API: system + ذاكرة المحادثة + سؤال المستخدم (مع صور إن وُجدت) */
    private buildMessages;
    /** ⏳ هل المزوّد في فترة تهدئة؟ */
    private isProviderCooling;
    /** 🧊 تهدئة مزوّد فشل — نتخطاه حتى انتهاء المدة */
    private coolProvider;
    /**
     * Resolve the order in which AI providers should be tried.
     * Uses aiConfig.provider if set, otherwise AI_PROVIDER from .env (default: auto).
     * Any available provider not in the preferred list is appended as failover.
     */
    /** 🔍 هل السيرفر المحدد لديه مزوّد API مخصص جاهز؟ */
    private customProviderAvailable;
    private resolveProviderOrder;
    private buildSystemPrompt;
    private generateOpenAI;
    /** موديلات Groq بالترتيب: المُهيّأ أولاً ثم بدائل معروفة بالحساب */
    private groqModelCandidates;
    private generateGroq;
    /** موديلات الرؤية على Groq (تدعم الصور) — تُستخدم فقط عند إرفاق صور */
    private groqVisionCandidates;
    private generateGemini;
    /** موديلات OpenRouter للرؤية — المجرّبة فعلياً أولاً (Gemini المباشر قد يكون مفتاحه معطلاً) */
    private openrouterVisionCandidates;
    /** موديلات OpenRouter النصية — مجانية أولاً ثم المدفوع كاحتياطي أخير */
    private openrouterTextCandidates;
    private generateOpenRouter;
    /** موديلات Requesty للرؤية — المجرّبة فعلياً مجانية (vision=true) */
    private requestyVisionCandidates;
    /** موديلات Requesty النصية — مجانية تماماً (input_price=0) */
    private requestyTextCandidates;
    private generateRequesty;
    private generateCustom;
    /** بث رد Groq مباشرة أثناء التوليد */
    private streamGroq;
    private generateAnthropic;
    private containsSensitiveContent;
    private emergencyResponse;
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
    /**
     * توليد تحليل أمني عبر مزوّدي الذكاء الاصطناعي مع تبديل تلقائي عند الفشل.
     * مستقل عن مساعد المحادثة: لا يستخدم الذاكرة ولا أدوات البحث ولا يرسل ردوداً.
     */
    generateInvestigation(prompt: string, systemPrompt: string, options?: {
        maxTokens?: number;
        temperature?: number;
    }): Promise<{
        content: string;
        tokensUsed: number;
        model: string;
    }>;
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