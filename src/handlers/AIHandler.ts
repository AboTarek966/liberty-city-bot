// ============================================
// Liberty City Bot - Advanced AI Handler
// ============================================

import {
  Client,
  Message,
  TextChannel,
  User,
  GuildMember,
  Role,
  ChannelType,
} from 'discord.js';
import { createLogger } from '../utils/helpers';
import { AIConfig, AIResponseRule, getGuildSettings } from '../models';
import { config } from '../config';

const logger = createLogger('AIHandler');

export interface AIResponse {
  content: string;
  tokensUsed: number;
  model: string;
  fallback: boolean;
}

export interface AIUserContext {
  username: string;
  isPrivileged: boolean;      // إداري (Administrator أو ManageGuild)
  roleNames: string[];
}

export class AIHandler {
  private client: Client;
  private openai: any = null;
  private anthropic: any = null;
  private groq: any = null;
  private cooldowns: Map<string, number> = new Map();
  private fallbackResponses: Map<string, string[]> = new Map();

  constructor(client: Client) {
    this.client = client;
    this.initializeProviders();
    this.loadFallbackResponses();
  }

  private initializeProviders(): void {
    // Initialize Groq (free tier - preferred)
    const groqKey = config.ai.groq.apiKey;
    if (groqKey && groqKey.startsWith('gsk_')) {
      try {
        const { OpenAI } = require('openai');
        this.groq = new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' });
        logger.info(`Groq provider initialized (model: ${config.ai.groq.model})`);
      } catch (error) {
        logger.warn('Failed to initialize Groq:', error);
      }
    }

    // Initialize OpenAI
    const openaiKey = config.ai.openai.apiKey;
    if (openaiKey && openaiKey !== 'your_openai_api_key_here' && openaiKey.startsWith('sk-')) {
      try {
        const { OpenAI } = require('openai');
        this.openai = new OpenAI({ apiKey: openaiKey });
        logger.info('OpenAI provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize OpenAI:', error);
      }
    }

    // Initialize Anthropic
    const anthropicKey = config.ai.anthropic.apiKey;
    if (anthropicKey && anthropicKey !== 'your_anthropic_api_key_here') {
      try {
        const { Anthropic } = require('@anthropic-ai/sdk');
        this.anthropic = new Anthropic({ apiKey: anthropicKey });
        logger.info('Anthropic provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize Anthropic:', error);
      }
    }

    if (!this.openai && !this.anthropic && !this.groq) {
      logger.warn('No AI providers configured. Using fallback responses only.');
    }
  }

  private loadFallbackResponses(): void {
    // Arabic fallback responses
    this.fallbackResponses.set('ar', [
      'أهلاً! أنا بوت Liberty City، كيف يمكنني مساعدتك؟ 🤖',
      'مرحباً بك! أنا هنا للمساعدة. هل لديك سؤال معين؟',
      'أنا بوت ذكي مصمم لمساعدتك. تفضل بطرح سؤالك!',
      'أهلاً! كيف يمكنني خدمتك اليوم؟',
      'مرحباً! أنا Liberty City، مساعدك الذكي. اسألني أي شيء! 😊',
      'أهلاً بك! هل تريد معرفة أوامر البوت؟ اكتب /help',
      'أنا هنا للمساعدة! هل هناك شيء معين تريد معرفته؟',
    ]);

    // English fallback responses
    this.fallbackResponses.set('en', [
      'Hello! I\'m Liberty City bot. How can I help you? 🤖',
      'Welcome! I\'m here to assist you. Do you have a question?',
      'Hi there! I\'m an AI assistant. Feel free to ask me anything!',
      'Hey! How can I help you today?',
      'Hello! I\'m Liberty City, your smart assistant. Ask me anything! 😊',
    ]);

    // Programming/Technical responses
    this.fallbackResponses.set('tech_ar', [
      'للأسف، أنا لا أملك وصولاً للذكاء الاصطناعي المتقدم حالياً. لكن يمكنني مساعدتك في أوامر البوت! اكتب /help',
      'ميزة الذكاء الاصطناعي تتطلب إعداد API Key. تواصل مع مالك البوت لتفعيلها.',
      'يمكنني مساعدتك في أوامر البوت، الحماية، التذاكر، والإعدادات. اكتب /help لرؤية جميع الأوامر.',
    ]);

    // General knowledge
    this.fallbackResponses.set('general_ar', [
      'هذا سؤال رائع! مع تفعيل الذكاء الاصطناعي، يمكنني إعطاء إجابة مفصلة. حالياً يمكنك استخدام أوامر البوت: /help',
      'للحصول على إجابات ذكية، يحتاج البوت لتكوين OpenAI أو Anthropic API. تواصل مع الإدارة.',
    ]);
  }

  // --------------------------------------------
  // Main Response Generation
  // --------------------------------------------
  async generateResponse(
    userId: string,
    guildId: string | undefined,
    channelId: string,
    message: string,
    userRoles: string[] = [],
    isMention: boolean = false,
    repliedToBot: boolean = false,
    opts: { fromCommand?: boolean; userContext?: AIUserContext } = {}
  ): Promise<AIResponse | null> {
    const { fromCommand = false, userContext } = opts;
    try {
      // Get AI config for guild (auto-create with defaults if missing)
      let aiConfig: any = guildId ? await AIConfig.findOne({ guildId }) : null;
      
      if (guildId && !aiConfig) {
        try {
          aiConfig = await AIConfig.create({ guildId, enabled: true });
        } catch (e) {
          // In case of race condition, re-fetch
          aiConfig = await AIConfig.findOne({ guildId });
        }
      }

      // DM case: use temporary default config
      if (!aiConfig) {
        aiConfig = {
          enabled: true,
          cooldown: 3,
          ignoredChannels: [],
          ignoredRoles: [],
          sensitiveKeywords: [],
          responseRules: [],
          language: 'ar',
          temperature: 0.7,
          maxTokens: 500,
          customPersonality: '',
          rolePersonalities: {},
        };
      }

      // Respect admin's choice: if AI is disabled, don't respond
      if (!aiConfig.enabled) {
        return null;
      }

      // Check cooldown
      const cooldownKey = `${userId}-${guildId || 'dm'}`;
      const lastUsed = this.cooldowns.get(cooldownKey) || 0;
      const now = Date.now();
      const cooldownMs = (aiConfig.cooldown || 3) * 1000;
      
      if (now - lastUsed < cooldownMs) {
        return null;
      }

      // Check ignored channels/roles
      if (aiConfig.ignoredChannels?.includes(channelId)) return null;
      if (userRoles.some(r => aiConfig.ignoredRoles?.includes(r))) return null;

      // Check if should respond (command usage, mention or reply to bot)
      const shouldRespond = fromCommand || isMention || repliedToBot || (guildId && await this.shouldAutoReply(guildId, channelId, message));
      if (!shouldRespond) return null;

      // Check sensitive keywords (الإداريين يتجاوزون الفلتر - فالذكاء الاصطناعي لا يملك أي أسرار حقيقية)
      if (!userContext?.isPrivileged && this.containsSensitiveContent(message, aiConfig.sensitiveKeywords)) {
        return {
          content: '❌ لا يمكنني الرد على هذا الموضوع الحساس.',
          tokensUsed: 0,
          model: 'security-filter',
          fallback: true,
        };
      }

      // Check custom response rules
      const customResponse = await this.checkCustomRules(guildId!, message, userRoles, aiConfig);
      if (customResponse) {
        this.cooldowns.set(cooldownKey, now);
        return customResponse;
      }

      // Generate AI response
      let response = await this.generateAIResponse(message, aiConfig, userRoles, guildId!, userContext);
      this.cooldowns.set(cooldownKey, now);

      // Echo guard: never send the user's own question back to them
      if (response && !response.fallback && this.isEchoResponse(message, response.content)) {
        logger.warn('Echo response detected from AI provider - replacing with fallback');
        response = this.getFallbackResponse(aiConfig.language || 'ar');
      }

      return response;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return this.getFallbackResponse(guildId ? 'ar' : 'en');
    }
  }

  /**
   * Detects if an AI response is just (a near copy of) the user's question.
   */
  private isEchoResponse(question: string, answer: string): boolean {
    const normalize = (s: string): string =>
      s.toLowerCase().replace(/[؟?!.,،;:\s"'`+\-/\\[\](){}*_#|]+/g, '').trim();

    const q = normalize(question);
    const a = normalize(answer);
    if (!q || !a) return false;

    // Exact echo (after normalization)
    if (q === a) return true;

    // Answer is essentially just the question with tiny additions
    const tolerance = Math.max(6, Math.floor(q.length * 0.2));
    if (q.length >= 4 && a.includes(q) && a.length <= q.length + tolerance) return true;

    // Answer is a short fragment fully contained in the question
    const toleranceA = Math.max(6, Math.floor(a.length * 0.2));
    if (a.length >= 4 && q.includes(a) && q.length <= a.length + toleranceA) return true;

    return false;
  }

  // --------------------------------------------
  // Check Custom Response Rules
  // --------------------------------------------
  private async checkCustomRules(
    guildId: string,
    message: string,
    userRoles: string[],
    aiConfig: any
  ): Promise<AIResponse | null> {
    if (!aiConfig.responseRules?.length) return null;

    // Sort by priority (highest first)
    const rules = [...aiConfig.responseRules]
      .filter((r: any) => r.enabled)
      .sort((a: any, b: any) => b.priority - a.priority);

    for (const rule of rules) {
      // Check role restriction
      if (rule.roleId && !userRoles.includes(rule.roleId)) continue;

      // Check trigger (simple contains or regex)
      const triggered = this.checkTrigger(message, rule.trigger);
      if (triggered) {
        return {
          content: rule.response,
          tokensUsed: 0,
          model: 'custom-rule',
          fallback: false,
        };
      }
    }

    return null;
  }

  private checkTrigger(message: string, trigger: string): boolean {
    // Support simple contains or regex
    try {
      if (trigger.startsWith('/') && trigger.endsWith('/')) {
        const regex = new RegExp(trigger.slice(1, -1), 'i');
        return regex.test(message);
      }
      return message.toLowerCase().includes(trigger.toLowerCase());
    } catch {
      return message.toLowerCase().includes(trigger.toLowerCase());
    }
  }

  // --------------------------------------------
  // Auto Reply Logic
  // --------------------------------------------
  private async shouldAutoReply(guildId: string, channelId: string, message: string): Promise<boolean> {
    // Could add logic for random replies, keyword triggers, etc.
    return false;
  }

  // --------------------------------------------
  // Generate AI Response
  // --------------------------------------------
  private async generateAIResponse(
    message: string,
    aiConfig: any,
    userRoles: string[],
    guildId: string,
    userContext?: AIUserContext
  ): Promise<AIResponse> {
    // Check for role-specific personality
    let personality = aiConfig.customPersonality;
    for (const roleId of userRoles) {
      if (aiConfig.rolePersonalities?.[roleId]) {
        personality = aiConfig.rolePersonalities[roleId];
        break;
      }
    }

    const systemPrompt = await this.buildSystemPrompt(aiConfig, personality, guildId, userContext);

    // Try AI providers (preferred first, others as automatic failover)
    const providerOrder = this.resolveProviderOrder(aiConfig.provider);
    for (const provider of providerOrder) {
      try {
        if (provider === 'groq') return await this.generateGroq(message, systemPrompt, aiConfig);
        if (provider === 'openai') return await this.generateOpenAI(message, systemPrompt, aiConfig);
        if (provider === 'anthropic') return await this.generateAnthropic(message, systemPrompt, aiConfig);
      } catch (error: any) {
        logger.warn(`AI provider "${provider}" failed: ${error?.message || error}`);
      }
    }

    // Fallback
    return this.getFallbackResponse(aiConfig.language || 'ar');
  }

  /**
   * Resolve the order in which AI providers should be tried.
   * Uses aiConfig.provider if set, otherwise AI_PROVIDER from .env (default: auto).
   * Any available provider not in the preferred list is appended as failover.
   */
  private resolveProviderOrder(configured?: string): Array<'groq' | 'openai' | 'anthropic'> {
    const available: Array<'groq' | 'openai' | 'anthropic'> = [];
    if (this.groq) available.push('groq');
    if (this.openai) available.push('openai');
    if (this.anthropic) available.push('anthropic');

    const pref = (configured || config.ai.provider || 'auto') as string;
    let preferred: Array<'groq' | 'openai' | 'anthropic'>;

    switch (pref) {
      case 'groq': preferred = ['groq']; break;
      case 'openai': preferred = ['openai']; break;
      case 'anthropic': preferred = ['anthropic']; break;
      case 'both': preferred = ['openai', 'anthropic']; break;
      default: preferred = ['groq', 'openai', 'anthropic']; // auto
    }

    const primary = preferred.filter(p => available.includes(p));
    const failover = available.filter(p => !primary.includes(p));
    return [...primary, ...failover];
  }

  private async buildSystemPrompt(
    aiConfig: any,
    personality: string,
    guildId: string,
    userContext?: AIUserContext
  ): Promise<string> {
    let prompt = aiConfig.systemPrompt || config.ai.systemPrompt;
    
    if (personality) {
      prompt += `\n\nشخصيتك الحالية: ${personality}`;
    }

    // ---------------- سياق السيرفر (معلومات عامة) ----------------
    const guild = this.client.guilds.cache.get(guildId);
    if (guild) {
      const textChannels = guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .map(c => `#${c.name}`)
        .slice(0, 20);
      const roleNames = guild.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => r.name)
        .slice(0, 25);

      prompt += `\n\n=== معلومات السيرفر (عامة - يُسمح بمشاركتها مع أي عضو) ===`;
      prompt += `\nالاسم: ${guild.name} | عدد الأعضاء: ${guild.memberCount} | تاريخ الإنشاء: ${new Date(guild.createdTimestamp).toLocaleDateString('en-CA')}`;
      prompt += `\nالقنوات النصية (${textChannels.length}): ${textChannels.join('، ') || 'لا يوجد'}`;
      prompt += `\nالرتب (${roleNames.length}): ${roleNames.join('، ') || 'لا يوجد'}`;
    }

    prompt += `\n\nاللغة المفضلة: ${aiConfig.language === 'ar' ? 'العربية' : aiConfig.language === 'en' ? 'English' : 'كلاهما'}`;
    prompt += `\nقواعد صارمة:`;
    prompt += `\n1. لا تكرر سؤال المستخدم أبداً، أجب مباشرة عليه.`;
    prompt += `\n2. لا تقل "سؤالك هو..." أو "أنت تسأل عن..." — أجب فقط.`;
    prompt += `\n3. كن مختصراً ومفيداً (2-4 جمل عادةً).`;
    prompt += `\n4. لا ترد على مواضيع حساسة (سياسة، دين، معلومات شخصية، كلمات مرور، أرقام بطاقات) — قل "لا يمكنني المساعدة في هذا".`;
    prompt += `\n5. أنت مساعد بوت Discord اسمه Liberty City.`;

    // ---------------- هوية المستخدم + مستوى الوصول ----------------
    if (userContext) {
      prompt += `\n\n=== المستخدم الحالي ===`;
      prompt += `\nالاسم: ${userContext.username}`;
      if (userContext.roleNames.length > 0) {
        prompt += `\nرتبه: ${userContext.roleNames.join('، ')}`;
      }

      if (userContext.isPrivileged) {
        // --- إداري: يمكنه معرفة المعلومات الحساسة ---
        try {
          const settings = await getGuildSettings(guildId);
          const on = (v: boolean) => (v ? 'مفعّل ✅' : 'معطّل ❌');

          prompt += `\n\n=== معلومات حساسة (للاطلاع - أنت تتحدث مع إداري يحق له معرفتها) ===`;
          prompt += `\nالبادئة: ${settings.prefix} | لغة البوت: ${settings.language}`;
          prompt += `\nالحماية: ضد الرويد ${on(settings.protection.antiRaid.enabled)}، ضد السبام ${on(settings.protection.antiSpam.enabled)}، ضد الروابط ${on(settings.protection.antiLink.enabled)}، ضد الدعوات ${on(settings.protection.antiInvite.enabled)}، ضد المنشنز ${on(settings.protection.antiMention.enabled)}`;
          prompt += `\nالتذاكر: ${settings.tickets.categoryId ? 'مُعدة' : 'غير مُعدة'} | الحد الأقصى للتذاكر/عضو: ${settings.tickets.maxPerUser} | رولات الدعم: ${settings.tickets.supportRoleIds.length}`;
          prompt += `\nالسجلات: ${on(settings.logging.enabled)}${settings.logging.channelId ? ` في <#${settings.logging.channelId}>` : ''} | الأحداث المسجلة: ${settings.logging.types.length || 'الكل'}`;
          prompt += `\nالترحيب: ${on(settings.welcome.enabled)}${settings.welcome.channelId ? ` في <#${settings.welcome.channelId}>` : ''} | المغادرة: ${on(settings.leave.enabled)}`;
          prompt += `\nالأوتو مود: ${on(settings.automod.enabled)} (كلمات محظورة: ${settings.automod.badWords.length}) | المستويات: ${on(settings.leveling.enabled)}`;
          prompt += `\nالروول التلقائي: ${settings.autorole?.enabled && settings.autorole?.roleId ? `<@&${settings.autorole.roleId}>` : 'غير مفعّل'}`;
          prompt += `\nيمكنك إعطاء هذه التفاصيل لهذا الإداري عند سؤالك عنها. لا تفصح عن أسرار تقنية (كلمات مرور أو مفاتيح API) أبداً لأنك لا تعرفها أصلاً.`;
        } catch {
          /* تجاهل */
        }
      } else {
        // --- عضو عادي: المعلومات الحساسة ممنوعة ---
        prompt += `\n\n=== أمان المعلومات (المستخدم عضو عادي) ===`;
        prompt += `\nممنوع تماماً ذكر هذه المعلومات لغير الإداريين:`;
        prompt += `\n- إعدادات الحماية ومستوى تفعيلها، إعدادات السجلات وقنواتها`;
        prompt += `\n- محتوى التذاكر، أرقام التذاكر، أسماء فريق الدعم كفريق`;
        prompt += `\n- هوية الإدارة/المشرفين منسوبين كإدارة، أسباب العقوبات`;
        prompt += `\n- أي إعدادات تقنية أو إعدادات البوت`;
        prompt += `\nإذا سأل عن شيء من هذا: أجب باختصار "هذه معلومات للإدارة فقط 🙂".`;
        prompt += `\nالمعلومات العامة مسموحة دائماً: عدد الأعضاء، القنوات، الرتب، تاريخ السيرفر، الأوامر المتاحة.`;
      }
    }

    return prompt;
  }

  private async generateOpenAI(message: string, systemPrompt: string, aiConfig: any): Promise<AIResponse> {
    const model = aiConfig.aiModel || config.ai.openai.model || 'gpt-4o-mini';
    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: aiConfig.temperature || 0.7,
      max_tokens: aiConfig.maxTokens || 500,
    });

    return {
      content: completion.choices[0]?.message?.content || 'عذراً، لم أتمكن من توليد رد.',
      tokensUsed: completion.usage?.total_tokens || 0,
      model: 'openai-' + model,
      fallback: false,
    };
  }

  private async generateGroq(message: string, systemPrompt: string, aiConfig: any): Promise<AIResponse> {
    const model = config.ai.groq.model;
    const completion = await this.groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: typeof aiConfig.temperature === 'number' ? aiConfig.temperature : config.ai.groq.temperature,
      max_tokens: Math.min(aiConfig.maxTokens || 500, config.ai.groq.maxTokens),
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty response from Groq');

    return {
      content,
      tokensUsed: completion.usage?.total_tokens || 0,
      model: 'groq-' + model,
      fallback: false,
    };
  }

  private async generateAnthropic(message: string, systemPrompt: string, aiConfig: any): Promise<AIResponse> {
    const response = await this.anthropic.messages.create({
      model: aiConfig.aiModel || config.ai.anthropic.model,
      max_tokens: aiConfig.maxTokens || 500,
      temperature: aiConfig.temperature || 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    const content = response.content[0]?.type === 'text' ? response.content[0].text : 'عذراً، لم أتمكن من توليد رد.';

    return {
      content,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model: 'anthropic-' + (aiConfig.aiModel || config.ai.anthropic.model),
      fallback: false,
    };
  }

  // --------------------------------------------
  // Security Filter
  // --------------------------------------------
  private containsSensitiveContent(message: string, keywords: string[] = []): boolean {
    const defaultSensitive = [
      'password', 'كلمة مرور', 'كلمة السر', 'باسورد',
      'token', 'توكن', 'api key', 'مفتاح',
      'credit card', 'بطاقة ائتمان', 'رقم بطاقة',
      'ssn', 'رقم وطني', 'هوية',
      'address', 'عنوان سكن', 'موقع سكن',
      'phone', 'رقم هاتف', 'جوال',
      'email', 'بريد إلكتروني', 'إيميل',
    ];

    const allKeywords = [...defaultSensitive, ...keywords];
    const lowerMessage = message.toLowerCase();

    return allKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
  }

  // --------------------------------------------
  // Fallback Responses
  // --------------------------------------------
  private getFallbackResponse(language: string): AIResponse {
    const responses = this.fallbackResponses.get(language) || this.fallbackResponses.get('ar')!;
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      content: randomResponse,
      tokensUsed: 0,
      model: 'fallback',
      fallback: true,
    };
  }

  // --------------------------------------------
  // AI Command Handler
  // --------------------------------------------
  async handleAICommand(
    interaction: any,
    prompt: string,
    options: { model?: string; temperature?: number; maxTokens?: number; ephemeral?: boolean } = {}
  ): Promise<void> {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const channelId = interaction.channelId;

    await interaction.deferReply({ ephemeral: options.ephemeral });

    // Check if AI is available
    if (!this.openai && !this.anthropic && !this.groq) {
      await interaction.editReply({
        content: '❌ ميزة الذكاء الاصطناعي غير مفعلة. يرجى إضافة `OPENAI_API_KEY` أو `ANTHROPIC_API_KEY` في ملف `.env` وتفعيل البوت.',
      });
      return;
    }

    const response = await this.generateResponse(userId, guildId!, channelId, prompt, [], false, false, { fromCommand: true });
    
    if (!response) {
      await interaction.editReply({ content: '❌ حدث خطأ في توليد الرد.' });
      return;
    }

    const embed = {
      title: '🤖 رد الذكاء الاصطناعي',
      description: response.content,
      color: response.fallback ? 0xFFD700 : 0x00D4FF,
      footer: {
        text: `Model: ${response.model} | Tokens: ${response.tokensUsed}${response.fallback ? ' (Fallback)' : ''}`,
      },
      timestamp: new Date().toISOString(),
    };

    await interaction.editReply({ embeds: [embed] });
  }

  // --------------------------------------------
  // Configuration Management
  // --------------------------------------------
  async getConfig(guildId: string) {
    let config = await AIConfig.findOne({ guildId });
    if (!config) {
      config = await AIConfig.create({ guildId });
    }
    return config;
  }

  async updateConfig(guildId: string, data: Partial<any>) {
    return await AIConfig.findOneAndUpdate(
      { guildId },
      { $set: data },
      { upsert: true, new: true }
    );
  }

  async addResponseRule(guildId: string, rule: { name: string; trigger: string; response: string; roleId?: string; priority?: number; createdBy: string }) {
    const config = await this.getConfig(guildId);
    config.responseRules.push({
      ...rule,
      priority: rule.priority || 0,
      enabled: true,
    } as any);
    await config.save();
    return config.responseRules[config.responseRules.length - 1];
  }

  async removeResponseRule(guildId: string, ruleId: string) {
    const config = await this.getConfig(guildId);
    config.responseRules = config.responseRules.filter((r: any) => r._id?.toString() !== ruleId);
    await config.save();
  }

  async setRolePersonality(guildId: string, roleId: string, personality: string) {
    const config = await this.getConfig(guildId);
    config.rolePersonalities = config.rolePersonalities || {};
    config.rolePersonalities[roleId] = personality;
    await config.save();
  }

  async removeRolePersonality(guildId: string, roleId: string) {
    const config = await this.getConfig(guildId);
    delete config.rolePersonalities?.[roleId];
    await config.save();
  }

  // --------------------------------------------
  // Utility
  // --------------------------------------------
  isAvailable(): boolean {
    return !!this.openai || !!this.anthropic || !!this.groq;
  }

  getProviders(): string[] {
    const providers: string[] = [];
    if (this.groq) providers.push('Groq');
    if (this.openai) providers.push('OpenAI');
    if (this.anthropic) providers.push('Anthropic');
    if (providers.length === 0) providers.push('Fallback Only');
    return providers;
  }

  clearCooldown(userId: string, guildId?: string): void {
    this.cooldowns.delete(`${userId}-${guildId || 'dm'}`);
  }

  // Check cooldown for a user (for command usage)
  checkCooldown(userId: string, guildId?: string): { onCooldown: boolean; remaining: number } {
    const key = `${userId}-${guildId || 'dm'}`;
    const lastUsed = this.cooldowns.get(key) || 0;
    const cooldownMs = (config.ai.cooldown || 3) * 1000;
    const elapsed = Date.now() - lastUsed;

    if (elapsed < cooldownMs) {
      return { onCooldown: true, remaining: cooldownMs - elapsed };
    }
    return { onCooldown: false, remaining: 0 };
  }

  // Set cooldown (after successful response)
  setCooldown(userId: string, guildId?: string): void {
    const key = `${userId}-${guildId || 'dm'}`;
    this.cooldowns.set(key, Date.now());
  }

  // Clear conversation history
  async clearHistory(userId: string, guildId: string, channelId: string): Promise<void> {
    try {
      const { AISession } = require('../models');
      await AISession.deleteMany({ userId, guildId });
    } catch (error) {
      logger.error('Error clearing AI history:', error);
    }
  }

  // Get provider info
  getProviderInfo(): {
    provider: string;
    model: string;
    openaiAvailable: boolean;
    anthropicAvailable: boolean;
    groqAvailable?: boolean;
  } {
    return {
      provider: this.getProviders().join(' + '),
      model: this.groq ? config.ai.groq.model : (config.ai.openai.model || 'gpt-4o-mini'),
      openaiAvailable: !!this.openai,
      anthropicAvailable: !!this.anthropic,
      groqAvailable: !!this.groq,
    };
  }

  // Get session info
  async getSessionInfo(userId: string, guildId: string, channelId: string): Promise<{ messageCount: number }> {
    try {
      const { AISession } = require('../models');
      const session = await AISession.findOne({ userId, guildId });
      return { messageCount: session?.messages?.length || 0 };
    } catch (error) {
      return { messageCount: 0 };
    }
  }
}

export default AIHandler;