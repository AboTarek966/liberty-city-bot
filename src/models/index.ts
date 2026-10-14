// ============================================
// Liberty City Bot - Database Models
// ============================================

import mongoose, { Document, Schema, Model } from 'mongoose';

// Import new models
import { CommandAlias } from './CommandAlias';
import { AIConfig, AIResponseRule } from './AIConfig';
import { GameStats } from './GameStats';
import { Poll } from './Poll';
import { ModuleSetting, AutoModRule, LevelingConfig, WelcomeConfig, LeaveConfig, LoggingConfig, BackupConfig } from './AdvancedSettings';

// --------------------------------------------
// Interfaces
// --------------------------------------------
export interface IGuildSettings extends Document {
  guildId: string;
  prefix: string;
  language: string;
  timezone: string;
  
  // إعدادات الحماية بكلمة مرور
  settingsPassword?: string; // كلمة مرور لوحة الإعدادات (افتراضي: 7421)
  
  // Protection
  protection: {
    antiRaid: {
      enabled: boolean;
      threshold: number;
      timeWindow: number;
      action: 'kick' | 'ban' | 'lockdown';
      logChannel?: string;
    };
    antiSpam: {
      enabled: boolean;
      maxMessages: number;
      timeWindow: number;
      action: 'warn' | 'mute' | 'kick' | 'ban';
      muteDuration: number;
      logChannel?: string;
    };
    antiLink: {
      enabled: boolean;
      whitelist: string[];
      action: 'delete' | 'warn' | 'mute';
      ignoreRoles: string[];
      logChannel?: string;
    };
    antiInvite: {
      enabled: boolean;
      action: 'delete' | 'warn' | 'mute';
      ignoreRoles: string[];
      logChannel?: string;
    };
    antiMention: {
      enabled: boolean;
      max: number;
      action: 'delete' | 'warn' | 'mute';
      logChannel?: string;
    };
    antiCaps: {
      enabled: boolean;
      minLength: number;
      percentage: number;
      action: 'delete' | 'warn' | 'mute';
      logChannel?: string;
    };
    antiEmoji: {
      enabled: boolean;
      max: number;
      action: 'delete' | 'warn' | 'mute';
      logChannel?: string;
    };
    antiNuke: {
      enabled: boolean;
      threshold: number;
      timeWindow: number;
      action: 'alert' | 'kick' | 'ban';
      logChannel?: string;
    };
    antiBot: {
      enabled: boolean;
      whitelist: string[];
      logChannel?: string;
    };
    antiAdmin: {
      enabled: boolean;
      action: 'alert' | 'kick';
      logChannel?: string;
    };
    autoBackup: {
      enabled: boolean;
      interval: number;
      keep: number;
    };
    /** فلتر الروابط الاحتيالية (صيد النيترو والمشاريع المزيفة) */
    scamFilter: {
      enabled: boolean;
    };
    /** وضع الطوارئ — يقفل الكتابة والدخول في جميع القنوات */
    lockdown: boolean;
  };
  
  // Tickets
  tickets: {
    categoryId?: string;
    logChannelId?: string;
    transcriptChannelId?: string;
    supportRoleIds: string[];
    maxPerUser: number;
    autoCloseHours: number;
    panels: ITicketPanel[];
    autoMessageEnabled: boolean;
    autoMessage: string;
    /** عداد التذاكر — للترقيم التسلسلي (1، 2، 3...) */
    counter: number;
    /** استبيان الرضا (نجوم) بعد إغلاق التذكرة */
    surveyEnabled: boolean;
    /** رولات الإدارة العليا — تُمنشن فقط عند زر استدعاء الإدارة */
    adminRoleIds: string[];
    /** 🔒 قفل التذكرة — لا يكتب صاحب التذكرة حتى يستلمها إداري */
    lockUntilClaim: boolean;
    /** 🎫 إرسال رسالة الترحيب داخل التذكرة (الزرار والخيارات) */
    welcomeEnabled: boolean;
    /** 📊 إحصائيات استلام التذاكر لكل إداري (userId → عدد التذاكر المستلمة) */
    claimStats: Map<string, number>;
  };
  
  // Logging
  logging: {
    enabled: boolean;
    channelId?: string;
    types: string[];
    /** 🔀 تقسيم: نوع الحدث → قناة مخصصة (وإلا يذهب للقناة الرئيسية) */
    channels: Record<string, string>;
    ignoredChannels: string[];
    ignoredRoles: string[];
  };

  // 🕵️ سنايب — استرجاع الرسائل المحذوفة
  snipe: {
    enabled: boolean;
  };

  // Welcome/Leave
  welcome: {
    enabled: boolean;
    channelId?: string;
    message: string;
    dmEnabled: boolean;
    dmMessage: string;
    imageEnabled: boolean;
    imageBackground?: string;
    embedColor: string;
    embedTitle: string;
    embedThumbnail?: string;
    /** 🖼️ بطاقة ترحيب مخصصة على صورة (مثل ProBot) */
    card: {
      enabled: boolean;
      backgroundUrl?: string;
      avatarX: number;
      avatarY: number;
      avatarSize: number;
      nameX: number;
      nameY: number;
      nameSize: number;
      nameColor: string;
      countX: number;
      countY: number;
      countSize: number;
      countColor: string;
    };
  };
  
  leave: {
    enabled: boolean;
    channelId?: string;
    message: string;
    embedColor: string;
  };
  // Jail (السجن)
  jail: {
    enabled: boolean;
    channelId?: string; // روم السجن
    jailRoleId?: string; // رول السجن
  };
  
  // AutoMod
  automod: {
    enabled: boolean;
    badWords: string[];
    badWordsAction: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
    badWordsDuration: number;
    zalgoEnabled: boolean;
    zalgoAction: 'delete' | 'warn' | 'mute';
    ignoredRoles: string[];
    ignoredChannels: string[];
  };
  
  // Economy/Leveling
  economy: {
    enabled: boolean;
    currency: string;
    currencySymbol: string;
    dailyAmount: number;
    workAmount: { min: number; max: number };
    begAmount: { min: number; max: number };
    robEnabled: boolean;
    robCooldown: number;
    slotsEnabled: boolean;
    blackjackEnabled: boolean;
  };
  
  leveling: {
    enabled: boolean;
    xpPerMessage: number;
    xpCooldown: number;
    levelUpChannelId?: string;
    levelUpMessage: string;
    levelRoles: Map<number, string>;
    /** مكافآت الرولات عند المستويات — يمكن أكثر من رول بنفس المستوى */
    levelRewards: ILevelReward[];
    /** نمط رسالة الترقية: نص عادي أو إمبد احترافي */
    levelUpStyle: 'text' | 'embed';
    /** عنوان إمبد الترقية (يحول المتغيرات) */
    levelUpTitle: string;
    /** لون إمبد الترقية (HEX) */
    levelUpColor: string;
    xpGainMultiplier: number;
    voiceXpPerMinute: number;
    ignoredChannels: string[];
    ignoredRoles: string[];
  };
  
  // AI
  ai: {
    enabled: boolean;
    provider: 'openai' | 'anthropic' | 'both';
    model: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    cooldown: number;
    allowedChannels: string[];
    allowedRoles: string[];
    ignoredChannels: string[];
    ignoredRoles: string[];
    responseLanguage: string;
  };
  
  // Custom
  customCommands: ICustomCommand[];
  tags: ITag[];
  reactionRoles: IReactionRole[];

  // Auto-Role (رول تلقائي عند الانضمام)
  autorole: {
    enabled: boolean;
    roleId?: string;
  };

  // Role Menus (قوائم الرتب بالأزرار)
  roleMenus: IRoleMenu[];

  // Verification (نظام التوثيق بالزر)
  verification: {
    enabled: boolean;
    channelId?: string;
    roleId?: string;
    title: string;
    description: string;
    buttonLabel: string;
    buttonEmoji: string;
  };

  // Shop (متجر السيرفر — شراء رولات بالرصيد)
  shop: {
    enabled: boolean;
    items: IShopItem[];
  };

  // 🎭 رولات التحذير — تُعرض كخيارات فقط عند تنفيذ /warn
  warnRoles: {
    /** رولات تحذير الأعضاء (تظهر عند تحذير عضو عادي) */
    memberIds: string[];
    /** رولات تحذير الإداريين (تظهر عند تحذير إداري) — للتوافق القديم */
    adminIds: string[];
    /** نظام التحذيرات التسلسلي للإداريين (جديد) */
    adminSequential?: {
      /** رول التحذير الأول */
      role1Id?: string;
      /** رول التحذير الثاني */
      role2Id?: string;
      /** رول التحذير الثالث */
      role3Id?: string;
    };
  };

  updatedAt: Date;
}

export interface ITicketPanel {
  id: string;
  name: string;
  description: string;
  emoji: string;
  channelId: string;
  messageId?: string;
  type: 'button' | 'select';
  fields: ITicketField[];
  /** أنواع التذاكر المعروضة في قائمة اللوحة (تُستخدم كاسم لقناة التذكرة) */
  options?: ITicketOption[];
  supportRoleIds: string[];
  image?: string;
}

export interface ITicketOption {
  label: string;
  description?: string;
  emoji?: string;
}

export interface ITicketField {
  id: string;
  label: string;
  placeholder: string;
  style: 'short' | 'paragraph';
  required: boolean;
}

export interface ICustomCommand {
  name: string;
  content: string;
  embed: boolean;
  /** 🔒 'public' = للجميع · 'admin' = لحاملي Administrator فقط */
  scope?: 'public' | 'admin';
  createdBy: string;
  createdAt: Date;
  uses: number;
}

export interface ITag {
  name: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  uses: number;
}

export interface IReactionRole {
  messageId: string;
  channelId: string;
  roles: IReactionRoleEntry[];
}

export interface IReactionRoleEntry {
  emoji: string;
  roleId: string;
  type: 'unique' | 'multiple';
}

export interface IRoleMenu {
  messageId: string;
  channelId: string;
  title: string;
  roleIds: string[];
}

export interface IModerationCase extends Document {
  guildId: string;
  caseId: number;
  type: 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unwarn' | 'timeout' | 'untimeout' | 'softban' | 'note' | 'role_add' | 'role_remove';
  moderatorId: string;
  targetId: string;
  reason: string;
  duration?: number;
  expiresAt?: Date;
  proof?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWarning extends Document {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  caseId: number;
  createdAt: Date;
}

/** بيانات السجن */
export interface IJailData extends Document {
  guildId: string;
  userId: string;
  previousRoles: string[];
  jailRoleId: string;
  jailedBy: string;
  reason: string;
  jailedAt: Date;
  duration?: number; // ms, null = دائم
  jailChannelId: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicket extends Document {
  guildId: string;
  channelId: string;
  userId: string;
  type: string;
  panelId?: string;
  status: 'open' | 'claimed' | 'waiting' | 'closed' | 'deleted';
  claimedBy?: string;
  /** سجل الإداريين الذين استلموا هذه التذكرة (لعدم احتساب نقاط مكررة) */
  claimHistory?: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject?: string;
  fields: ITicketFieldResponse[];
  transcript?: string;
  closedBy?: string;
  closeReason?: string;
  locked?: boolean;
  lockGrantedUsers?: string[];
  /** لقطة لحالة صلاحيات القناة قبل القفل — لإرجاعها كما كانت عند إلغاء القفل */
  lockSnapshots?: ITicketLockSnapshot[];
  /**
   * لقطة صلاحيات القناة قبل الإغلاق — تُطبَّق قاعدة الإغلاق الصارمة:
   * لا يكتب أحد أثناء الإغلاق (لا الإداريون ولا صاحب التذكرة)، ويُعاد فتحها
   * من قبل من أغلقها فقط، وعندها تُرجع الصلاحيات كما كانت تماماً.
   */
  closeSnapshots?: ITicketLockSnapshot[];
  /** آخر نشاط في التذكرة (رسالة) — للكشف عن الخمول والإغلاق التلقائي */
  lastActivityAt?: Date;
  /** تم إرسال تحذير الخمول لهذه التذكرة */
  idleWarned?: boolean;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface ITicketFieldResponse {
  question: string;
  answer: string;
}

export interface ITicketLockSnapshot {
  /** معرف العضو أو الرول الذي طُبّق عليه القفل */
  id: string;
  /** bitfield الصلاحيات المسموحة قبل القفل */
  allow: string;
  /** bitfield الصلاحيات المرفوضة قبل القفل */
  deny: string;
  /** هل كان هناك overwrite أصلاً قبل القفل؟ */
  existed: boolean;
}

/** مكافأة رول عند مستوى معيّن (يمكن أكثر من رول في نفس المستوى) */
export interface ILevelReward {
  level: number;
  roleId: string;
}

/** عنصر متجر — يشتريه العضو بالرصيد ويحصل على رول */
export interface IShopItem {
  id: string;
  name: string;
  price: number;
  roleId: string;
  emoji?: string;
}

export interface IAISession extends Document {
  userId: string;
  guildId?: string;
  channelId?: string;
  messages: IAISessionMessage[];
  lastActivity: Date;
  tokenCount: number;
}

export interface IAISessionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IUserProfile extends Document {
  userId: string;
  guildId: string;
  balance: number;
  bank: number;
  xp: number;
  level: number;
  totalXp: number;
  messagesSent: number;
  voiceTime: number;
  lastDaily?: Date;
  lastWork?: Date;
  lastBeg?: Date;
  lastRob?: Date;
  inventory: IInventoryItem[];
  badges: string[];
  reputation: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInventoryItem {
  itemId: string;
  name: string;
  description: string;
  quantity: number;
  price: number;
  usable: boolean;
  roleId?: string;
}

export interface IMuteRole extends Document {
  guildId: string;
  roleId: string;
  createdAt: Date;
}

export interface ILoggerSettings extends Document {
  guildId: string;
  channelId?: string;
  types: string[];
  ignoredChannels: string[];
  ignoredRoles: string[];
}

// --------------------------------------------
// Schemas
// --------------------------------------------

// Guild Settings Schema
const TicketOptionSchema = new Schema<ITicketOption>({
  label: { type: String, required: true },
  description: { type: String },
  emoji: { type: String },
}, { _id: false });

const TicketFieldSchema = new Schema<ITicketField>({
  id: { type: String, required: true },
  label: { type: String, required: true },
  placeholder: { type: String, required: true },
  style: { type: String, enum: ['short', 'paragraph'], required: true },
  required: { type: Boolean, default: false },
}, { _id: false });

const TicketPanelSchema = new Schema<ITicketPanel>({
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

const CustomCommandSchema = new Schema<ICustomCommand>({
  name: { type: String, required: true },
  content: { type: String, required: true },
  embed: { type: Boolean, default: false },
  // 🔒 نطاق الأمر: 'public' = للجميع · 'admin' = لحاملي Administrator فقط
  scope: { type: String, enum: ['public', 'admin'], default: 'public' },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  uses: { type: Number, default: 0 },
}, { _id: false });

const TagSchema = new Schema<ITag>({
  name: { type: String, required: true },
  content: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  uses: { type: Number, default: 0 },
}, { _id: false });

const ReactionRoleEntrySchema = new Schema<IReactionRoleEntry>({
  emoji: { type: String, required: true },
  roleId: { type: String, required: true },
  type: { type: String, enum: ['unique', 'multiple'], default: 'multiple' },
}, { _id: false });

const ReactionRoleSchema = new Schema<IReactionRole>({
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  roles: [ReactionRoleEntrySchema],
}, { _id: false });

const RoleMenuSchema = new Schema<IRoleMenu>({
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  title: { type: String, default: '' },
  roleIds: [{ type: String }],
}, { _id: false });

// مكافأة رول عند مستوى معيّن (يمكن أكثر من رول بنفس المستوى)
const LevelRewardSchema = new Schema<ILevelReward>({
  level: { type: Number, required: true, min: 1 },
  roleId: { type: String, required: true },
}, { _id: false });

// عنصر متجر (شراء رول بالرصيد)
const ShopItemSchema = new Schema<IShopItem>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  roleId: { type: String, required: true },
  emoji: { type: String },
}, { _id: false });

const GuildSettingsSchema = new Schema<IGuildSettings>({
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
    channels: { type: Schema.Types.Mixed, default: {} },
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
    adminSequential: {
      role1Id: { type: String, default: '' },
      role2Id: { type: String, default: '' },
      role3Id: { type: String, default: '' },
    },
  },

  updatedAt: { type: Date, default: Date.now },
});

// Moderation Case Schema
const ModerationCaseSchema = new Schema<IModerationCase>({
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
const WarningSchema = new Schema<IWarning>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, required: true },
  caseId: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Jail Data Schema
const JailDataSchema = new Schema<IJailData>({
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
const TicketFieldResponseSchema = new Schema<ITicketFieldResponse>({
  question: { type: String, required: true },
  answer: { type: String, required: true },
}, { _id: false });

// لقطة صلاحيات قناة التذكرة قبل تطبيق القفل (لإعادتها كما كانت)
const TicketLockSnapshotSchema = new Schema<ITicketLockSnapshot>({
  id: { type: String, required: true },
  allow: { type: String, required: true },
  deny: { type: String, required: true },
  existed: { type: Boolean, default: true },
}, { _id: false });

const TicketSchema = new Schema<ITicket>({
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
  closeSnapshots: [TicketLockSnapshotSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
  lastActivityAt: { type: Date, default: Date.now },
  idleWarned: { type: Boolean, default: false },
});

// AI Session Schema
const AIMessageSchema = new Schema<IAISessionMessage>({
  role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const AISessionSchema = new Schema<IAISession>({
  userId: { type: String, required: true, index: true },
  guildId: { type: String, index: true },
  channelId: { type: String },
  messages: [AIMessageSchema],
  lastActivity: { type: Date, default: Date.now },
  tokenCount: { type: Number, default: 0 },
});

// User Profile Schema
const InventoryItemSchema = new Schema<IInventoryItem>({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  usable: { type: Boolean, default: false },
  roleId: { type: String },
}, { _id: false });

const UserProfileSchema = new Schema<IUserProfile>({
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
const MuteRoleSchema = new Schema<IMuteRole>({
  guildId: { type: String, required: true, unique: true, index: true },
  roleId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// --------------------------------------------
// AFK (وضع عدم الوجود) — يُلغى تلقائياً عند أول رسالة
// --------------------------------------------
export interface IUserAFK extends Document {
  guildId: string;
  userId: string;
  reason: string;
  since: Date;
}

const UserAFKSchema = new Schema<IUserAFK>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  reason: { type: String, default: 'AFK' },
  since: { type: Date, default: Date.now },
});

UserAFKSchema.index({ guildId: 1, userId: 1 }, { unique: true });

// --------------------------------------------
// Model Exports
// --------------------------------------------
export const GuildSettings = mongoose.model<IGuildSettings>('GuildSettings', GuildSettingsSchema);
export const ModerationCase = mongoose.model<IModerationCase>('ModerationCase', ModerationCaseSchema);
export const Warning = mongoose.model<IWarning>('Warning', WarningSchema);
export const JailData = mongoose.model<IJailData>('JailData', JailDataSchema);
export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
export const AISession = mongoose.model<IAISession>('AISession', AISessionSchema);
export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
export const MuteRole = mongoose.model<IMuteRole>('MuteRole', MuteRoleSchema);
export const UserAFK = mongoose.model<IUserAFK>('UserAFK', UserAFKSchema);

// Re-export new models
export { CommandAlias } from './CommandAlias';
export { AIConfig, AIResponseRule } from './AIConfig';
export { GameStats } from './GameStats';
export { Poll, IPoll } from './Poll';
export { ModuleSetting, AutoModRule, LevelingConfig, WelcomeConfig, LeaveConfig, LoggingConfig, BackupConfig } from './AdvancedSettings';

// --------------------------------------------
// Helper Functions
// --------------------------------------------

// ⚡ ذاكرة مؤقتة لإعدادات السيرفر — تسرّع كل التفاعلات والأوامر
// (تُستخدم نفس الوثيقة للمدة الصالحة — التعديلات والحفظ تعمل كالمعتاد)
const settingsCache = new Map<string, { doc: IGuildSettings; ts: number }>();
const SETTINGS_CACHE_TTL_MS = 30_000;

export async function getGuildSettings(guildId: string): Promise<IGuildSettings> {
  const hit = settingsCache.get(guildId);
  if (hit && Date.now() - hit.ts < SETTINGS_CACHE_TTL_MS) return hit.doc;

  let settings = await GuildSettings.findOne({ guildId });
  if (!settings) {
    settings = await GuildSettings.create({ guildId });
  }
  settingsCache.set(guildId, { doc: settings, ts: Date.now() });
  return settings;
}

/** إجبار إعادة الجلب من قاعدة البيانات (بعد تعديل خارجي مباشر) */
export function invalidateGuildSettings(guildId: string): void {
  settingsCache.delete(guildId);
}

export async function getOrCreateUserProfile(userId: string, guildId: string): Promise<IUserProfile> {
  let profile = await UserProfile.findOne({ userId, guildId });
  if (!profile) {
    profile = await UserProfile.create({ userId, guildId });
  }
  return profile;
}

export async function getNextCaseId(guildId: string): Promise<number> {
  const lastCase = await ModerationCase.findOne({ guildId }).sort({ caseId: -1 });
  return (lastCase?.caseId || 0) + 1;
}

export default {
  GuildSettings,
  ModerationCase,
  Warning,
  Ticket,
  AISession,
  UserProfile,
  MuteRole,
  CommandAlias,
  AIConfig,
  AIResponseRule,
  GameStats,
  Poll,
  ModuleSetting,
  AutoModRule,
  LevelingConfig,
  WelcomeConfig,
  LeaveConfig,
  LoggingConfig,
  BackupConfig,
  getGuildSettings,
  getOrCreateUserProfile,
  getNextCaseId,
};