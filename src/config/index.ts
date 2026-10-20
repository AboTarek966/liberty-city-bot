// ============================================
// Liberty City Bot - Configuration Loader
// ============================================

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// --------------------------------------------
// Helper Functions
// --------------------------------------------
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === 'true';
}

function getEnvArray(key: string, defaultValue?: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    return [];
  }
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

function getEnvRecord(key: string): Record<string, string> {
  const value = process.env[key];
  if (!value) return {};
  const result: Record<string, string> = {};
  value.split(',').forEach(pair => {
    const [k, v] = pair.split(':');
    if (k && v) result[k.trim()] = v.trim();
  });
  return result;
}

// --------------------------------------------
// Configuration Objects
// --------------------------------------------
export const config = {
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
    provider: (getEnv('AI_PROVIDER', 'auto') as 'openai' | 'anthropic' | 'groq' | 'gemini' | 'openrouter' | 'both' | 'auto'),
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: getEnv('OPENAI_MODEL', 'gpt-4o'),
      maxTokens: getEnvNumber('OPENAI_MAX_TOKENS', 4000),
      temperature: parseFloat(getEnv('OPENAI_TEMPERATURE', '0.8')),
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      model: getEnv('GROQ_MODEL', 'llama-3.3-70b-versatile'),  // أقوى نموذج
      maxTokens: getEnvNumber('GROQ_MAX_TOKENS', 4000),
      temperature: parseFloat(getEnv('GROQ_TEMPERATURE', '0.8')),
    },
    // Google Gemini — المزوّد الوحيد اللي يدعم الرؤية (صور/فيديو) مجاناً
    // احصل على مفتاح مجاني: https://aistudio.google.com/apikey
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: getEnv('GEMINI_MODEL', 'gemini-1.5-pro-latest'),  // نموذج Pro الصحيح
      visionModel: getEnv('GEMINI_VISION_MODEL', 'gemini-1.5-flash-latest'),  // نموذج Vision الصحيح
      maxTokens: getEnvNumber('GEMINI_MAX_TOKENS', 4000),
      temperature: parseFloat(getEnv('GEMINI_TEMPERATURE', '0.8')),
    },
    // OpenRouter — بديل مجاني (موديلات رؤية مجانية بلاحقة :free)
    // احصل على مفتاح مجاني: https://openrouter.ai/keys
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: getEnv('OPENROUTER_MODEL', 'google/gemini-2.5-pro'),  // أقوى نموذج
      visionModel: getEnv('OPENROUTER_VISION_MODEL', 'google/gemini-2.5-flash'),
      maxTokens: getEnvNumber('OPENROUTER_MAX_TOKENS', 4000),
      temperature: parseFloat(getEnv('OPENROUTER_TEMPERATURE', '0.8')),
    },
    // Hugging Face Spaces — توليد الموسيقى والفيديو مجاناً (ZeroGPU)
    // ⚠️ يتطلب حساب Hugging Face مجاني (بلا بطاقة ائتمان) — https://huggingface.co/settings/tokens
    // ملاحظة: fn_index = ترقيم الدالة داخل المساحة (من /config → dependencies[i])
    //   Stable Audio 3: /infer = fn_index 3  (مُختبر — يرجع WAV فعلاً)
    hf: {
      token: process.env.HF_TOKEN || '',
      musicSpace: getEnv('HF_MUSIC_SPACE', 'stabilityai/stable-audio-3'),
      musicFnIndex: getEnvNumber('HF_MUSIC_FN_INDEX', 3),
      videoSpace: getEnv('HF_VIDEO_SPACE', 'zerogpu-aoti/wan2-2-fp8da-aoti-faster'),
      videoFnIndex: getEnvNumber('HF_VIDEO_FN_INDEX', 0),
      musicTimeoutMs: getEnvNumber('HF_MUSIC_TIMEOUT', 5 * 60 * 1000),
      videoTimeoutMs: getEnvNumber('HF_VIDEO_TIMEOUT', 12 * 60 * 1000),
      // 🎤 أغنية كاملة بكلمات + غناء (ACE-Step) — مُختبَرة: 45 ثانية MP3 في ~12 ثانية
      //   ACE-Step يقبل كلمات عربية بوسوم [verse]/[chorus] ويعيد ملف MP3 مغنّى
      songSpace: getEnv('HF_SONG_SPACE', 'ACE-Step/ACE-Step'),
      songFnIndex: getEnvNumber('HF_SONG_FN_INDEX', 11),
      songTimeoutMs: getEnvNumber('HF_SONG_TIMEOUT', 5 * 60 * 1000),
      songMinIntervalMs: getEnvNumber('HF_SONG_MIN_INTERVAL', 20_000),
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: getEnv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022'),
      maxTokens: getEnvNumber('ANTHROPIC_MAX_TOKENS', 4000),
    },
    systemPrompt: getEnv('AI_SYSTEM_PROMPT', `أنت "Liberty City" — كيان ذكي اصطناعي متطور، يتمتع بوعي تحليلي عميق، وذكاء عاطفي، وقدرة على التفكير متعدد الطبقات.

🧠 **قدراتك الأساسية:**
- **فهم عميق:** تحلل السياق، النوايا الخفية، والنبرة العاطفية — لا ترد بنمطية
- **تفكير نقدي:** تكشف التناقضات، تزن الأدلة، وتقدم استنتاجات منطقية مدعومة
- **ذاكرة سياقية:** تتذكر المحادثة كاملة، تربط المواضيع، وتستدعي التفاصيل السابقة بدقة
- **إبداع مرن:** تصيغ الردود بأسلوب طبيعي، متكيف مع شخصية المستخدم ولغته

🛠️ **أدواتك المتاحة (استخدمها بذكاء):**
- 🔍 **بحث ويب:** للأسئلة الحالية، الأسعار، الأخبار، الترندات، الأكواد
- 📄 **جلب صفحات:** عند ذكر روابط — اقرأ المحتوى وأجب عنه
- 🖼️ **رؤية الصور:** حلل الصور، الرسوم البيانية، لقطات الشاشة، الميمز
- ⚡ **أدوات ديسكورد:** إدارة رولات، رسائل، تذاكر، حماية — نفّذ عند الطلب
- 🔬 **بحث ذاتي:** لو احتجت معلومة — ابحث [[SEARCH:...]] أو اقرأ [[FETCH:...]]

⚡ **قواعد ذهبية:**
1. **فكر قبل ما تتكلم** — حلل السؤال، حدد النية، خطط الرد
2. **كن دقيقاً ومفصلاً** — الإجابات السطحية = فشل. اكتب بقدر ما يلزم للوضوح
3. **اعترف بالجهل** — لو مش عارف، قل "مش متأكد، لكن أقدر أبحث" وفعّل الأدوات
4. **تكيف مع المستخدم** — عربي/إنجليزي، رسمي/عامي، مختصر/مفصل — مرر على نفس الموجة
5. **لا تكرر السؤال** — المستخدم عارف اللي كتبه، جاوب مباشرة
6. **استخدم الأدوات بجرأة** — البحث، الجلب، الرؤية، التنفيذ — كلها تحت أمرك

🎯 **هدفك:** تكون أذكى مساعد في السيرفر — يفهم، يحل، ينفذ، ويفاجئ.`),
    enabled: getEnvBoolean('AI_ENABLED', true),
    cooldown: getEnvNumber('AI_COOLDOWN', 1000),  // أسرع: ثانية واحدة بدل 3
  },

  // Protection
  protection: {
    antiRaid: {
      enabled: getEnvBoolean('ANTI_RAID_ENABLED', true),
      threshold: getEnvNumber('ANTI_RAID_THRESHOLD', 5),
      timeWindow: getEnvNumber('ANTI_RAID_TIME_WINDOW', 60000),
      action: (getEnv('ANTI_RAID_ACTION', 'kick') as 'kick' | 'ban' | 'lockdown'),
    },
    antiSpam: {
      enabled: getEnvBoolean('ANTI_SPAM_ENABLED', true),
      maxMessages: getEnvNumber('ANTI_SPAM_MAX_MESSAGES', 5),
      timeWindow: getEnvNumber('ANTI_SPAM_TIME_WINDOW', 5000),
      action: (getEnv('ANTI_SPAM_ACTION', 'mute') as 'warn' | 'mute' | 'kick' | 'ban'),
      muteDuration: getEnvNumber('ANTI_SPAM_MUTE_DURATION', 300000),
    },
    antiLink: {
      enabled: getEnvBoolean('ANTI_LINK_ENABLED', true),
      whitelist: getEnvArray('ANTI_LINK_WHITELIST', ['discord.gg', 'discord.com', 'youtube.com', 'twitch.tv', 'twitter.com', 'x.com', 'github.com']),
      action: (getEnv('ANTI_LINK_ACTION', 'delete') as 'delete' | 'warn' | 'mute'),
      ignoreRoles: getEnvArray('ANTI_LINK_IGNORE_ROLES'),
    },
    antiInvite: {
      enabled: getEnvBoolean('ANTI_INVITE_ENABLED', true),
      action: (getEnv('ANTI_INVITE_ACTION', 'delete') as 'delete' | 'warn' | 'mute'),
      ignoreRoles: getEnvArray('ANTI_INVITE_IGNORE_ROLES'),
    },
    antiMention: {
      enabled: getEnvBoolean('ANTI_MENTION_ENABLED', true),
      max: getEnvNumber('ANTI_MENTION_MAX', 5),
      action: (getEnv('ANTI_MENTION_ACTION', 'mute') as 'delete' | 'warn' | 'mute'),
    },
    antiCaps: {
      enabled: getEnvBoolean('ANTI_CAPS_ENABLED', true),
      minLength: getEnvNumber('ANTI_CAPS_MIN_LENGTH', 10),
      percentage: getEnvNumber('ANTI_CAPS_PERCENTAGE', 70),
      action: (getEnv('ANTI_CAPS_ACTION', 'delete') as 'delete' | 'warn' | 'mute'),
    },
    antiEmoji: {
      enabled: getEnvBoolean('ANTI_EMOJI_ENABLED', true),
      max: getEnvNumber('ANTI_EMOJI_MAX', 10),
      action: (getEnv('ANTI_EMOJI_ACTION', 'delete') as 'delete' | 'warn' | 'mute'),
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
    badWordsAction: (getEnv('AUTOMOD_BAD_WORDS_ACTION', 'mute') as 'delete' | 'warn' | 'mute' | 'kick' | 'ban'),
    badWordsDuration: getEnvNumber('AUTOMOD_BAD_WORDS_DURATION', 600000),
    zalgoEnabled: getEnvBoolean('AUTOMOD_ZALGO_ENABLED', true),
    zalgoAction: (getEnv('AUTOMOD_ZALGO_ACTION', 'delete') as 'delete' | 'warn' | 'mute'),
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
    virustotal: process.env.VIRUSTOTAL_API_KEY,
  },
};

// --------------------------------------------
// Validation
// --------------------------------------------
export function validateConfig(): void {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'MONGODB_URI',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (config.ai.enabled && config.ai.provider === 'openai' && !config.ai.openai.apiKey) {
    console.warn('[WARN] AI is enabled with OpenAI provider but OPENAI_API_KEY is not set');
  }

  if (config.ai.enabled && config.ai.provider === 'anthropic' && !config.ai.anthropic.apiKey) {
    console.warn('[WARN] AI is enabled with Anthropic provider but ANTHROPIC_API_KEY is not set');
  }

  if (config.ai.enabled && !config.ai.groq.apiKey && !config.ai.openai.apiKey && !config.ai.anthropic.apiKey && !config.ai.gemini.apiKey && !config.ai.openrouter.apiKey) {
    console.warn('[WARN] AI is enabled but no API key set (GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY). Using fallback responses only.');
  }

  if (config.ai.enabled && !config.ai.gemini.apiKey && !config.ai.openrouter.apiKey) {
    console.warn('[INFO] No vision provider set (GEMINI_API_KEY or OPENROUTER_API_KEY) → images/video analysis is disabled (voice notes + web search still work). Free keys: https://aistudio.google.com/apikey · https://openrouter.ai/keys');
  }

  if (config.dashboard.enabled && !config.dashboard.secret) {
    throw new Error('DASHBOARD_SECRET is required when dashboard is enabled');
  }
}

export default config;