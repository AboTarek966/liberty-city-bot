"use strict";
// ============================================
// Liberty City Bot - Configuration Loader
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
// --------------------------------------------
// Helper Functions
// --------------------------------------------
function getEnv(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
function getEnvNumber(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Invalid number for environment variable: ${key}`);
    }
    return parsed;
}
function getEnvBoolean(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined)
            return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value.toLowerCase() === 'true';
}
function getEnvArray(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined)
            return defaultValue;
        return [];
    }
    return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}
function getEnvRecord(key) {
    const value = process.env[key];
    if (!value)
        return {};
    const result = {};
    value.split(',').forEach(pair => {
        const [k, v] = pair.split(':');
        if (k && v)
            result[k.trim()] = v.trim();
    });
    return result;
}
// --------------------------------------------
// Configuration Objects
// --------------------------------------------
exports.config = {
    // Discord
    discord: {
        token: getEnv('DISCORD_TOKEN'),
        clientId: getEnv('DISCORD_CLIENT_ID'),
        guildId: process.env.DISCORD_GUILD_ID,
        prefix: getEnv('PREFIX', 'lc!'),
        defaultLanguage: getEnv('DEFAULT_LANGUAGE', 'ar'),
        timezone: getEnv('TIMEZONE', 'Asia/Riyadh'),
        colors: {
            primary: getEnv('COLOR_PRIMARY', '#00D4FF'),
            success: getEnv('COLOR_SUCCESS', '#00FF88'),
            warning: getEnv('COLOR_WARNING', '#FFD700'),
            error: getEnv('COLOR_ERROR', '#FF3366'),
            info: getEnv('COLOR_INFO', '#00D4FF'),
        },
    },
    // Database
    database: {
        uri: getEnv('MONGODB_URI', 'mongodb://localhost:27017/liberty-city'),
    },
    // AI
    ai: {
        provider: getEnv('AI_PROVIDER', 'auto'),
        openai: {
            apiKey: process.env.OPENAI_API_KEY || '',
            model: getEnv('OPENAI_MODEL', 'gpt-4o-mini'),
            maxTokens: getEnvNumber('OPENAI_MAX_TOKENS', 2000),
            temperature: parseFloat(getEnv('OPENAI_TEMPERATURE', '0.7')),
        },
        groq: {
            apiKey: process.env.GROQ_API_KEY || '',
            model: getEnv('GROQ_MODEL', 'openai/gpt-oss-120b'),
            maxTokens: getEnvNumber('GROQ_MAX_TOKENS', 800),
            temperature: parseFloat(getEnv('GROQ_TEMPERATURE', '0.7')),
        },
        // Google Gemini — المزوّد الوحيد اللي يدعم الرؤية (صور/فيديو) مجاناً
        // احصل على مفتاح مجاني: https://aistudio.google.com/apikey
        gemini: {
            apiKey: process.env.GEMINI_API_KEY || '',
            model: getEnv('GEMINI_MODEL', 'gemini-3.5-flash'),
            visionModel: getEnv('GEMINI_VISION_MODEL', 'gemini-3.5-flash'),
            maxTokens: getEnvNumber('GEMINI_MAX_TOKENS', 800),
            temperature: parseFloat(getEnv('GEMINI_TEMPERATURE', '0.7')),
        },
        // OpenRouter — بديل مجاني (موديلات رؤية مجانية بلاحقة :free)
        // احصل على مفتاح مجاني: https://openrouter.ai/keys
        openrouter: {
            apiKey: process.env.OPENROUTER_API_KEY || '',
            model: getEnv('OPENROUTER_MODEL', 'google/gemma-4-26b-a4b-it:free'),
            visionModel: getEnv('OPENROUTER_VISION_MODEL', 'google/gemma-4-31b-it:free'),
            maxTokens: getEnvNumber('OPENROUTER_MAX_TOKENS', 800),
            temperature: parseFloat(getEnv('OPENROUTER_TEMPERATURE', '0.7')),
        },
        anthropic: {
            apiKey: process.env.ANTHROPIC_API_KEY || '',
            model: getEnv('ANTHROPIC_MODEL', 'claude-3-opus-20240229'),
            maxTokens: getEnvNumber('ANTHROPIC_MAX_TOKENS', 4000),
        },
        systemPrompt: getEnv('AI_SYSTEM_PROMPT', 'أنت مساعد ذكي لبوت Liberty City. أنت ودود، مفيد، وتتكلم العربية بطلاقة. تساعد أعضاء السيرفر في الأسئلة والمشاكل.'),
        enabled: getEnvBoolean('AI_ENABLED', true),
        cooldown: getEnvNumber('AI_COOLDOWN', 3000),
    },
    // Protection
    protection: {
        antiRaid: {
            enabled: getEnvBoolean('ANTI_RAID_ENABLED', true),
            threshold: getEnvNumber('ANTI_RAID_THRESHOLD', 5),
            timeWindow: getEnvNumber('ANTI_RAID_TIME_WINDOW', 60000),
            action: getEnv('ANTI_RAID_ACTION', 'kick'),
        },
        antiSpam: {
            enabled: getEnvBoolean('ANTI_SPAM_ENABLED', true),
            maxMessages: getEnvNumber('ANTI_SPAM_MAX_MESSAGES', 5),
            timeWindow: getEnvNumber('ANTI_SPAM_TIME_WINDOW', 5000),
            action: getEnv('ANTI_SPAM_ACTION', 'mute'),
            muteDuration: getEnvNumber('ANTI_SPAM_MUTE_DURATION', 300000),
        },
        antiLink: {
            enabled: getEnvBoolean('ANTI_LINK_ENABLED', true),
            whitelist: getEnvArray('ANTI_LINK_WHITELIST', ['discord.gg', 'discord.com', 'youtube.com', 'twitch.tv', 'twitter.com', 'x.com', 'github.com']),
            action: getEnv('ANTI_LINK_ACTION', 'delete'),
            ignoreRoles: getEnvArray('ANTI_LINK_IGNORE_ROLES'),
        },
        antiInvite: {
            enabled: getEnvBoolean('ANTI_INVITE_ENABLED', true),
            action: getEnv('ANTI_INVITE_ACTION', 'delete'),
            ignoreRoles: getEnvArray('ANTI_INVITE_IGNORE_ROLES'),
        },
        antiMention: {
            enabled: getEnvBoolean('ANTI_MENTION_ENABLED', true),
            max: getEnvNumber('ANTI_MENTION_MAX', 5),
            action: getEnv('ANTI_MENTION_ACTION', 'mute'),
        },
        antiCaps: {
            enabled: getEnvBoolean('ANTI_CAPS_ENABLED', true),
            minLength: getEnvNumber('ANTI_CAPS_MIN_LENGTH', 10),
            percentage: getEnvNumber('ANTI_CAPS_PERCENTAGE', 70),
            action: getEnv('ANTI_CAPS_ACTION', 'delete'),
        },
        antiEmoji: {
            enabled: getEnvBoolean('ANTI_EMOJI_ENABLED', true),
            max: getEnvNumber('ANTI_EMOJI_MAX', 10),
            action: getEnv('ANTI_EMOJI_ACTION', 'delete'),
        },
    },
    // Tickets
    tickets: {
        categoryName: getEnv('TICKET_CATEGORY_NAME', '🎫│التذاكر'),
        logChannelName: getEnv('TICKET_LOG_CHANNEL_NAME', '📋│سجل-التذاكر'),
        transcriptChannelName: getEnv('TICKET_TRANSCRIPT_CHANNEL_NAME', '📜│نسخ-التذاكر'),
        maxPerUser: getEnvNumber('TICKET_MAX_PER_USER', 3),
        autoCloseHours: getEnvNumber('TICKET_AUTO_CLOSE_HOURS', 24),
        supportRoles: getEnvArray('TICKET_SUPPORT_ROLES'),
    },
    // Logging
    logging: {
        level: getEnv('LOG_LEVEL', 'info'),
        channelId: process.env.LOG_CHANNEL_ID,
        types: getEnvArray('LOG_TYPES', [
            'messageDelete', 'messageUpdate', 'memberJoin', 'memberLeave',
            'roleCreate', 'roleDelete', 'channelCreate', 'channelDelete',
            'banAdd', 'banRemove', 'voiceStateUpdate'
        ]),
    },
    // Welcome/Leave
    welcome: {
        enabled: getEnvBoolean('WELCOME_ENABLED', true),
        channelName: getEnv('WELCOME_CHANNEL_NAME', '👋│الترحيب'),
        message: getEnv('WELCOME_MESSAGE', 'مرحباً {user}! أهلاً بك في **{server}**. أنت العضو رقم {count} 🎉'),
        dmEnabled: getEnvBoolean('WELCOME_DM_ENABLED', false),
        dmMessage: getEnv('WELCOME_DM_MESSAGE', 'مرحباً بك في {server}! نتمنى لك وقتاً ممتعاً.'),
        imageEnabled: getEnvBoolean('WELCOME_IMAGE_ENABLED', true),
        imageBackground: process.env.WELCOME_IMAGE_BACKGROUND,
    },
    leave: {
        enabled: getEnvBoolean('LEAVE_ENABLED', true),
        channelName: getEnv('LEAVE_CHANNEL_NAME', '👋│الترحيب'),
        message: getEnv('LEAVE_MESSAGE', '{user} غادر السيرفر. أصبح عدد الأعضاء {count} 😢'),
    },
    // AutoMod
    automod: {
        enabled: getEnvBoolean('AUTOMOD_ENABLED', true),
        badWords: getEnvArray('AUTOMOD_BAD_WORDS'),
        badWordsAction: getEnv('AUTOMOD_BAD_WORDS_ACTION', 'mute'),
        badWordsDuration: getEnvNumber('AUTOMOD_BAD_WORDS_DURATION', 600000),
        zalgoEnabled: getEnvBoolean('AUTOMOD_ZALGO_ENABLED', true),
        zalgoAction: getEnv('AUTOMOD_ZALGO_ACTION', 'delete'),
    },
    // Economy & Leveling
    economy: {
        enabled: getEnvBoolean('ECONOMY_ENABLED', true),
    },
    leveling: {
        enabled: getEnvBoolean('LEVELING_ENABLED', true),
        xpPerMessage: getEnvNumber('XP_PER_MESSAGE', 15),
        xpCooldown: getEnvNumber('XP_COOLDOWN', 60000),
        levelUpChannelName: getEnv('LEVEL_UP_CHANNEL_NAME', '📈│الترقيات'),
        levelRoles: getEnvRecord('LEVEL_ROLES'),
    },
    // Dashboard
    dashboard: {
        enabled: getEnvBoolean('DASHBOARD_ENABLED', false),
        port: getEnvNumber('DASHBOARD_PORT', 3000),
        secret: getEnv('DASHBOARD_SECRET', ''),
        callbackUrl: getEnv('DASHBOARD_CALLBACK_URL', 'http://localhost:3000/callback'),
        oauth2Secret: getEnv('DASHBOARD_OAUTH2_SECRET', ''),
    },
    // External APIs
    apis: {
        weather: process.env.WEATHER_API_KEY,
        youtube: process.env.YOUTUBE_API_KEY,
        tenor: process.env.TENOR_API_KEY,
    },
};
// --------------------------------------------
// Validation
// --------------------------------------------
function validateConfig() {
    const required = [
        'DISCORD_TOKEN',
        'DISCORD_CLIENT_ID',
        'MONGODB_URI',
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    if (exports.config.ai.enabled && exports.config.ai.provider === 'openai' && !exports.config.ai.openai.apiKey) {
        console.warn('[WARN] AI is enabled with OpenAI provider but OPENAI_API_KEY is not set');
    }
    if (exports.config.ai.enabled && exports.config.ai.provider === 'anthropic' && !exports.config.ai.anthropic.apiKey) {
        console.warn('[WARN] AI is enabled with Anthropic provider but ANTHROPIC_API_KEY is not set');
    }
    if (exports.config.ai.enabled && !exports.config.ai.groq.apiKey && !exports.config.ai.openai.apiKey && !exports.config.ai.anthropic.apiKey && !exports.config.ai.gemini.apiKey && !exports.config.ai.openrouter.apiKey) {
        console.warn('[WARN] AI is enabled but no API key set (GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY). Using fallback responses only.');
    }
    if (exports.config.ai.enabled && !exports.config.ai.gemini.apiKey && !exports.config.ai.openrouter.apiKey) {
        console.warn('[INFO] No vision provider set (GEMINI_API_KEY or OPENROUTER_API_KEY) → images/video analysis is disabled (voice notes + web search still work). Free keys: https://aistudio.google.com/apikey · https://openrouter.ai/keys');
    }
    if (exports.config.dashboard.enabled && !exports.config.dashboard.secret) {
        throw new Error('DASHBOARD_SECRET is required when dashboard is enabled');
    }
}
exports.default = exports.config;
//# sourceMappingURL=index.js.map