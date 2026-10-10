// ============================================
// Liberty City Bot - Advanced Settings Model
// ============================================

import mongoose, { Document, Schema } from 'mongoose';

export interface IModuleSetting extends Document {
  guildId: string;
  module: string;          // اسم الموديول
  enabled: boolean;
  config: Record<string, any>;
  updatedAt: Date;
}

export interface IAutoModRule extends Document {
  guildId: string;
  name: string;
  type: 'link' | 'invite' | 'word' | 'spam' | 'caps' | 'emoji' | 'mention' | 'attachment';
  action: 'delete' | 'warn' | 'timeout' | 'mute' | 'kick' | 'ban' | 'log';
  config: {
    words?: string[];           // للكلمات المحظورة
    threshold?: number;         // للسبام/الكابس/الإيموجي/المنشن
    timeWindow?: number;        // نافذة زمنية (ثانية)
    whitelist?: string[];       // روابط/كلمات مستثناة
    roles?: string[];           // رولات معفاة
    channels?: string[];        // قنوات معفاة
    duration?: number;          // للتايمأوت (ثانية)
    reason?: string;
  };
  enabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILevelingConfig extends Document {
  guildId: string;
  enabled: boolean;
  xpPerMessage: { min: number; max: number };
  xpCooldown: number;           // ثانية
  voiceXpPerMinute: number;
  ignoredChannels: string[];
  ignoredRoles: string[];
  levelUpChannel?: string;
  levelUpMessage: string;
  roles: Array<{ level: number; roleId: string }>;
  blacklistedUsers: string[];
}

export interface IWelcomeConfig extends Document {
  guildId: string;
  enabled: boolean;
  channelId?: string;
  message: string;
  embed: {
    enabled: boolean;
    title: string;
    description: string;
    color: string;
    thumbnail: boolean;
    image?: string;
    footer?: string;
  };
  dmEnabled: boolean;
  dmMessage: string;
  roles: string[];              // رولات تُعطى عند الانضمام
}

export interface ILeaveConfig extends Document {
  guildId: string;
  enabled: boolean;
  channelId?: string;
  message: string;
  embed: {
    enabled: boolean;
    title: string;
    description: string;
    color: string;
  };
}

export interface ILoggingConfig extends Document {
  guildId: string;
  enabled: boolean;
  channelId?: string;
  events: {
    messageDelete: boolean;
    messageEdit: boolean;
    memberJoin: boolean;
    memberLeave: boolean;
    memberBan: boolean;
    memberUnban: boolean;
    memberUpdate: boolean;
    roleCreate: boolean;
    roleDelete: boolean;
    roleUpdate: boolean;
    channelCreate: boolean;
    channelDelete: boolean;
    channelUpdate: boolean;
    voiceStateUpdate: boolean;
    inviteCreate: boolean;
    inviteDelete: boolean;
    webhookUpdate: boolean;
    integrationUpdate: boolean;
    threadCreate: boolean;
    threadDelete: boolean;
    threadUpdate: boolean;
  };
}

export interface IBackupConfig extends Document {
  guildId: string;
  enabled: boolean;
  interval: 'daily' | 'weekly' | 'monthly';
  channelId?: string;           // قناة لإرسال النسخ
  include: {
    roles: boolean;
    channels: boolean;
    permissions: boolean;
    settings: boolean;
    bans: boolean;
  };
  lastBackup?: Date;
  backups: Array<{
    date: Date;
    data: any;
    size: number;
  }>;
}

const ModuleSettingSchema = new Schema<IModuleSetting>({
  guildId: { type: String, required: true, index: true },
  module: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  config: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: false, updatedAt: true } });

ModuleSettingSchema.index({ guildId: 1, module: 1 }, { unique: true });

const AutoModRuleSchema = new Schema<IAutoModRule>({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['link', 'invite', 'word', 'spam', 'caps', 'emoji', 'mention', 'attachment'], required: true },
  action: { type: String, enum: ['delete', 'warn', 'timeout', 'mute', 'kick', 'ban', 'log'], required: true },
  config: { type: Schema.Types.Mixed, default: {} },
  enabled: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });

const LevelingConfigSchema = new Schema<ILevelingConfig>({
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

const WelcomeConfigSchema = new Schema<IWelcomeConfig>({
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

const LeaveConfigSchema = new Schema<ILeaveConfig>({
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

const LoggingConfigSchema = new Schema<ILoggingConfig>({
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

const BackupConfigSchema = new Schema<IBackupConfig>({
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
    data: Schema.Types.Mixed,
    size: Number,
  }],
});

export const ModuleSetting = mongoose.model<IModuleSetting>('ModuleSetting', ModuleSettingSchema);
export const AutoModRule = mongoose.model<IAutoModRule>('AutoModRule', AutoModRuleSchema);
export const LevelingConfig = mongoose.model<ILevelingConfig>('LevelingConfig', LevelingConfigSchema);
export const WelcomeConfig = mongoose.model<IWelcomeConfig>('WelcomeConfig', WelcomeConfigSchema);
export const LeaveConfig = mongoose.model<ILeaveConfig>('LeaveConfig', LeaveConfigSchema);
export const LoggingConfig = mongoose.model<ILoggingConfig>('LoggingConfig', LoggingConfigSchema);
export const BackupConfig = mongoose.model<IBackupConfig>('BackupConfig', BackupConfigSchema);

export default {
  ModuleSetting,
  AutoModRule,
  LevelingConfig,
  WelcomeConfig,
  LeaveConfig,
  LoggingConfig,
  BackupConfig,
};