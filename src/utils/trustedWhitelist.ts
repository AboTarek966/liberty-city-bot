// ============================================
// Omni Bot — Trusted Whitelist
// الوايت ليست الموثوقة: مساحة محدودة تحت الحماية، مالك السيرفر فقط.
// ليست حصانة — أي تجاوز للحدود يُعاقب كأي مخالفة عادية.
// ============================================

import { AuditLogEvent } from 'discord.js';

export interface TrustedWhitelistConfig {
  enabled: boolean;
  userIds: string[];
  minorActions: number;
  minorWindowSeconds: number;
  criticalActions: number;
  criticalWindowSeconds: number;
  allowDestructive: boolean;
  logChannel?: string;
}

export const DEFAULT_TRUSTED_WHITELIST: TrustedWhitelistConfig = {
  enabled: true,
  userIds: [],
  minorActions: 3,
  minorWindowSeconds: 300,
  criticalActions: 1,
  criticalWindowSeconds: 600,
  allowDestructive: false,
};

const clampInt = (value: any, fallback: number, min: number, max: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
};

/** قراءة إعدادات الوايت ليست الموثوقة مع قيم افتراضية آمنة */
export function getTrustedWhitelistConfig(settings: any): TrustedWhitelistConfig {
  const raw = settings?.protection?.trustedWhitelist || {};
  return {
    enabled: raw.enabled !== false,
    userIds: Array.isArray(raw.userIds) ? raw.userIds.map(String) : [],
    minorActions: clampInt(raw.minorActions, DEFAULT_TRUSTED_WHITELIST.minorActions, 0, 50),
    minorWindowSeconds: clampInt(
      raw.minorWindowSeconds,
      DEFAULT_TRUSTED_WHITELIST.minorWindowSeconds,
      10,
      86400
    ),
    criticalActions: clampInt(
      raw.criticalActions,
      DEFAULT_TRUSTED_WHITELIST.criticalActions,
      0,
      10
    ),
    criticalWindowSeconds: clampInt(
      raw.criticalWindowSeconds,
      DEFAULT_TRUSTED_WHITELIST.criticalWindowSeconds,
      30,
      86400
    ),
    allowDestructive: raw.allowDestructive === true,
    logChannel: raw.logChannel ? String(raw.logChannel) : undefined,
  };
}

/** هل العضو موجود في الوايت ليست الموثوقة؟ (لا يفحص البوتات — يفحصها المستدعي) */
export function isTrustedWhitelistMember(settings: any, userId: string | undefined): boolean {
  if (!userId) return false;
  const cfg = getTrustedWhitelistConfig(settings);
  return cfg.enabled && cfg.userIds.includes(String(userId));
}

// --------------------------------------------
// تصنيف أحداث سجل التدقيق
// --------------------------------------------
const MINOR_EVENTS = new Set<AuditLogEvent>([
  AuditLogEvent.ChannelCreate,
  AuditLogEvent.RoleCreate,
  AuditLogEvent.ThreadCreate,
  AuditLogEvent.ChannelUpdate,
  AuditLogEvent.ThreadUpdate,
  AuditLogEvent.EmojiCreate,
  AuditLogEvent.EmojiUpdate,
  AuditLogEvent.StickerCreate,
  AuditLogEvent.StickerUpdate,
  AuditLogEvent.InviteCreate,
  AuditLogEvent.InviteUpdate,
  AuditLogEvent.InviteDelete,
  AuditLogEvent.MessagePin,
  AuditLogEvent.MessageUnpin,
  AuditLogEvent.StageInstanceCreate,
  AuditLogEvent.StageInstanceUpdate,
  AuditLogEvent.GuildScheduledEventCreate,
  AuditLogEvent.GuildScheduledEventUpdate,
  AuditLogEvent.SoundboardSoundCreate,
  AuditLogEvent.SoundboardSoundUpdate,
  AuditLogEvent.VoiceChannelStatusCreate,
  AuditLogEvent.VoiceChannelStatusDelete,
  AuditLogEvent.MemberMove,
]);

/** هل الحدث خفيف (إنشاء/تعديل غير مدمّر)؟ */
export function isMinorAuditEvent(action: number): boolean {
  return MINOR_EVENTS.has(action as AuditLogEvent);
}

/** تصنيف مبسّط للاستخدام في منح المساحة */
export function auditEventAllowanceKind(action: number): 'minor' | 'critical' {
  return isMinorAuditEvent(action) ? 'minor' : 'critical';
}

/** اسم عربي مختصر لحدث تدقيق (للتنبيهات والسجلات) */
const AUDIT_LABELS: Partial<Record<AuditLogEvent, string>> = {
  [AuditLogEvent.GuildUpdate]: 'تعديل إعدادات السيرفر',
  [AuditLogEvent.ChannelCreate]: 'إنشاء قناة',
  [AuditLogEvent.ChannelUpdate]: 'تعديل قناة',
  [AuditLogEvent.ChannelDelete]: 'حذف قناة',
  [AuditLogEvent.ChannelOverwriteCreate]: 'إنشاء استثناء صلاحيات',
  [AuditLogEvent.ChannelOverwriteUpdate]: 'تعديل استثناء صلاحيات',
  [AuditLogEvent.ChannelOverwriteDelete]: 'حذف استثناء صلاحيات',
  [AuditLogEvent.MemberKick]: 'طرد عضو',
  [AuditLogEvent.MemberPrune]: 'تنظيف أعضاء',
  [AuditLogEvent.MemberBanAdd]: 'حظر عضو',
  [AuditLogEvent.MemberBanRemove]: 'رفع حظر عضو',
  [AuditLogEvent.MemberUpdate]: 'تعديل بيانات عضو',
  [AuditLogEvent.MemberRoleUpdate]: 'تعديل رولات عضو',
  [AuditLogEvent.MemberMove]: 'نقل عضو صوتياً',
  [AuditLogEvent.MemberDisconnect]: 'فصل عضو صوتياً',
  [AuditLogEvent.RoleCreate]: 'إنشاء رول',
  [AuditLogEvent.RoleUpdate]: 'تعديل رول',
  [AuditLogEvent.RoleDelete]: 'حذف رول',
  [AuditLogEvent.InviteCreate]: 'إنشاء دعوة',
  [AuditLogEvent.InviteUpdate]: 'تعديل دعوة',
  [AuditLogEvent.InviteDelete]: 'حذف دعوة',
  [AuditLogEvent.WebhookCreate]: 'إنشاء ويب هوك',
  [AuditLogEvent.WebhookUpdate]: 'تعديل ويب هوك',
  [AuditLogEvent.WebhookDelete]: 'حذف ويب هوك',
  [AuditLogEvent.EmojiCreate]: 'إنشاء إيموجي',
  [AuditLogEvent.EmojiUpdate]: 'تعديل إيموجي',
  [AuditLogEvent.EmojiDelete]: 'حذف إيموجي',
  [AuditLogEvent.MessageBulkDelete]: 'حذف رسائل جماعي',
  [AuditLogEvent.MessagePin]: 'تثبيت رسالة',
  [AuditLogEvent.MessageUnpin]: 'إلغاء تثبيت رسالة',
  [AuditLogEvent.IntegrationCreate]: 'إنشاء تكامل',
  [AuditLogEvent.IntegrationUpdate]: 'تعديل تكامل',
  [AuditLogEvent.IntegrationDelete]: 'حذف تكامل',
  [AuditLogEvent.StageInstanceCreate]: 'إنشاء مرحلة',
  [AuditLogEvent.StageInstanceUpdate]: 'تعديل مرحلة',
  [AuditLogEvent.StageInstanceDelete]: 'حذف مرحلة',
  [AuditLogEvent.StickerCreate]: 'إنشاء ستيكر',
  [AuditLogEvent.StickerUpdate]: 'تعديل ستيكر',
  [AuditLogEvent.StickerDelete]: 'حذف ستيكر',
  [AuditLogEvent.GuildScheduledEventCreate]: 'إنشاء حدث مجدول',
  [AuditLogEvent.GuildScheduledEventUpdate]: 'تعديل حدث مجدول',
  [AuditLogEvent.GuildScheduledEventDelete]: 'حذف حدث مجدول',
  [AuditLogEvent.ThreadCreate]: 'إنشاء ثريد',
  [AuditLogEvent.ThreadUpdate]: 'تعديل ثريد',
  [AuditLogEvent.ThreadDelete]: 'حذف ثريد',
  [AuditLogEvent.ApplicationCommandPermissionUpdate]: 'تعديل صلاحيات أوامر التطبيقات',
  [AuditLogEvent.SoundboardSoundCreate]: 'إنشاء صوت لوحة',
  [AuditLogEvent.SoundboardSoundUpdate]: 'تعديل صوت لوحة',
  [AuditLogEvent.SoundboardSoundDelete]: 'حذف صوت لوحة',
  [AuditLogEvent.AutoModerationRuleCreate]: 'إنشاء قاعدة أوتومود',
  [AuditLogEvent.AutoModerationRuleUpdate]: 'تعديل قاعدة أوتومود',
  [AuditLogEvent.AutoModerationRuleDelete]: 'حذف قاعدة أوتومود',
  [AuditLogEvent.OnboardingCreate]: 'إنشاء إعدادات ترحيب',
  [AuditLogEvent.OnboardingUpdate]: 'تعديل إعدادات ترحيب',
  [AuditLogEvent.OnboardingPromptCreate]: 'إنشاء سؤال ترحيب',
  [AuditLogEvent.OnboardingPromptUpdate]: 'تعديل سؤال ترحيب',
  [AuditLogEvent.OnboardingPromptDelete]: 'حذف سؤال ترحيب',
  [AuditLogEvent.HomeSettingsCreate]: 'إنشاء إعدادات الصفحة الرئيسية',
  [AuditLogEvent.HomeSettingsUpdate]: 'تعديل إعدادات الصفحة الرئيسية',
  [AuditLogEvent.VoiceChannelStatusCreate]: 'إنشاء حالة قناة صوتية',
  [AuditLogEvent.VoiceChannelStatusDelete]: 'حذف حالة قناة صوتية',
};

export function auditEventLabel(action: number): string {
  return AUDIT_LABELS[action as AuditLogEvent] || `حدث أمني (${action})`;
}
