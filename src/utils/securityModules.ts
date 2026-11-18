// ============================================
// Omni Bot — Extended Security Modules
// سجل وحدات الحماية الموسّعة (35+ نوع حماية)
// كل وحدة لها مفتاح ثابت، وصف عربي، شدة، عتبة افتراضية ونافذة زمنية.
// تُدار من أمر /shield وتُطبَّق من SecurityHandler.onAuditEntry.
// ============================================

import { AuditLogEvent } from 'discord.js';

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';
export type SecurityAction = 'alert' | 'kick' | 'ban' | 'strip';

export interface SecurityModuleDefinition {
  /** مفتاح ثابت يُحفظ في قاعدة البيانات */
  key: string;
  /** اسم عربي مختصر */
  name: string;
  emoji: string;
  description: string;
  category: string;
  severity: SecuritySeverity;
  /** أحداث سجل التدقيق التي تغطيها الوحدة */
  events: AuditLogEvent[];
  /** الحد الافتراضي داخل النافذة */
  defaultLimit: number;
  /** النافذة الزمنية الافتراضية بالثواني */
  defaultWindowSeconds: number;
  /** العقوبة الافتراضية عند التجاوز */
  defaultAction: SecurityAction;
  /** هل الحدث إنشائي/خفيف؟ (يمنح الوايت ليست الموثوقة مساحة أكبر) */
  minor: boolean;
  /** فلتر اختياري لسجل التدقيق — يُستخدم لتجاهل تغييرات غير مهمة */
  match?: (entry: any) => boolean;
  /** تسمية الحدث للتنبيهات */
  eventLabels?: Partial<Record<AuditLogEvent, string>>;
}

const changeKeys = (entry: any): string[] =>
  Array.isArray(entry?.changes)
    ? entry.changes.map((c: any) => String(c?.key || '')).filter(Boolean)
    : [];

export const SECURITY_MODULES: SecurityModuleDefinition[] = [
  // --------------------------------------------
  // 🏰 السيرفر والإعدادات العامة
  // --------------------------------------------
  {
    key: 'guild_settings',
    name: 'إعدادات السيرفر',
    emoji: '🏰',
    description: 'تغيير اسم السيرفر/الأيقونة/الرابط المختصر/الإعدادات العامة',
    category: 'السيرفر',
    severity: 'critical',
    events: [AuditLogEvent.GuildUpdate],
    defaultLimit: 3,
    defaultWindowSeconds: 300,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.GuildUpdate]: 'تعديل إعدادات السيرفر' },
  },
  {
    key: 'home_settings',
    name: 'إعدادات الصفحة الرئيسية',
    emoji: '🏠',
    description: 'إنشاء/تعديل إعدادات الصفحة الرئيسية للسيرفر',
    category: 'السيرفر',
    severity: 'medium',
    events: [AuditLogEvent.HomeSettingsCreate, AuditLogEvent.HomeSettingsUpdate],
    defaultLimit: 2,
    defaultWindowSeconds: 300,
    defaultAction: 'strip',
    minor: false,
  },
  {
    key: 'onboarding_update',
    name: 'إعدادات الترحيب',
    emoji: '🚪',
    description: 'تعديل Onboarding (الترحيب/Rules) للسيرفر',
    category: 'السيرفر',
    severity: 'high',
    events: [AuditLogEvent.OnboardingCreate, AuditLogEvent.OnboardingUpdate],
    defaultLimit: 2,
    defaultWindowSeconds: 300,
    defaultAction: 'strip',
    minor: false,
  },
  {
    key: 'onboarding_prompt',
    name: 'أسئلة الترحيب',
    emoji: '📝',
    description: 'إنشاء/تعديل/حذف أسئلة الترحيب الجماعية',
    category: 'السيرفر',
    severity: 'medium',
    events: [
      AuditLogEvent.OnboardingPromptCreate,
      AuditLogEvent.OnboardingPromptUpdate,
      AuditLogEvent.OnboardingPromptDelete,
    ],
    defaultLimit: 5,
    defaultWindowSeconds: 300,
    defaultAction: 'strip',
    minor: false,
  },

  // --------------------------------------------
  // 👥 الأعضاء والعقوبات
  // --------------------------------------------
  {
    key: 'member_update',
    name: 'تعديل بيانات الأعضاء',
    emoji: '👤',
    description: 'تغيير الأسماء المستعارة أو التايم أوت بشكل جماعي/متكرر',
    category: 'الأعضاء',
    severity: 'high',
    events: [AuditLogEvent.MemberUpdate],
    defaultLimit: 8,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: false,
    match: (entry) =>
      changeKeys(entry).some((k) =>
        ['nick', 'communication_disabled_until', 'mute', 'deaf', 'avatar'].includes(k)
      ),
    eventLabels: { [AuditLogEvent.MemberUpdate]: 'تعديل بيانات أعضاء' },
  },
  {
    key: 'member_role_mass',
    name: 'تعديل رولات الأعضاء',
    emoji: '🎖️',
    description: 'إعطاء/سحب رولات من أعضاء متعددين بسرعة',
    category: 'الأعضاء',
    severity: 'critical',
    events: [AuditLogEvent.MemberRoleUpdate],
    defaultLimit: 5,
    defaultWindowSeconds: 30,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.MemberRoleUpdate]: 'تعديل رولات الأعضاء' },
  },
  {
    key: 'ban_remove',
    name: 'رفع الحظر الجماعي',
    emoji: '🔓',
    description: 'رفع حظر أعضاء متعددين بسرعة (قد يخفي اعتداءً سابقاً)',
    category: 'الأعضاء',
    severity: 'medium',
    events: [AuditLogEvent.MemberBanRemove],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: false,
    eventLabels: { [AuditLogEvent.MemberBanRemove]: 'رفع حظر أعضاء' },
  },
  {
    key: 'member_move',
    name: 'نقل الأعضاء صوتياً',
    emoji: '🔀',
    description: 'نقل أعضاء بين القنوات الصوتية بشكل جماعي',
    category: 'الأعضاء',
    severity: 'medium',
    events: [AuditLogEvent.MemberMove],
    defaultLimit: 8,
    defaultWindowSeconds: 20,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.MemberMove]: 'نقل أعضاء صوتياً' },
  },
  {
    key: 'member_disconnect',
    name: 'فصل الأعضاء صوتياً',
    emoji: '🔌',
    description: 'فصل أعضاء من القنوات الصوتية بشكل جماعي',
    category: 'الأعضاء',
    severity: 'high',
    events: [AuditLogEvent.MemberDisconnect],
    defaultLimit: 3,
    defaultWindowSeconds: 20,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.MemberDisconnect]: 'فصل أعضاء صوتياً' },
  },

  // --------------------------------------------
  // 📨 الدعوات والروابط
  // --------------------------------------------
  {
    key: 'invite_create',
    name: 'إنشاء الدعوات',
    emoji: '🔗',
    description: 'إنشاء دعوات متعددة بسرعة (فتح أبواب للسيرفر)',
    category: 'الدعوات',
    severity: 'medium',
    events: [AuditLogEvent.InviteCreate],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.InviteCreate]: 'إنشاء دعوات' },
  },
  {
    key: 'invite_delete',
    name: 'حذف الدعوات',
    emoji: '✂️',
    description: 'حذف دعوات متعددة بسرعة',
    category: 'الدعوات',
    severity: 'medium',
    events: [AuditLogEvent.InviteDelete],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.InviteDelete]: 'حذف دعوات' },
  },
  {
    key: 'invite_update',
    name: 'تعديل الدعوات',
    emoji: '📝',
    description: 'تعديل إعدادات الدعوات',
    category: 'الدعوات',
    severity: 'low',
    events: [AuditLogEvent.InviteUpdate],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.InviteUpdate]: 'تعديل دعوة' },
  },

  // --------------------------------------------
  // 😀 التعبيرات (إيموجي/ستيكر)
  // --------------------------------------------
  {
    key: 'emoji_create',
    name: 'إنشاء الإيموجي',
    emoji: '😀',
    description: 'إضافة إيموجي متعددة بسرعة',
    category: 'التعبيرات',
    severity: 'low',
    events: [AuditLogEvent.EmojiCreate],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.EmojiCreate]: 'إنشاء إيموجي' },
  },
  {
    key: 'emoji_update',
    name: 'تعديل الإيموجي',
    emoji: '🎨',
    description: 'تعديل إيموجي متعددة بسرعة',
    category: 'التعبيرات',
    severity: 'medium',
    events: [AuditLogEvent.EmojiUpdate],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: true,
    eventLabels: { [AuditLogEvent.EmojiUpdate]: 'تعديل إيموجي' },
  },
  {
    key: 'sticker_create',
    name: 'إنشاء الستيكر',
    emoji: '🖼️',
    description: 'إضافة ستيكرات متعددة بسرعة',
    category: 'التعبيرات',
    severity: 'low',
    events: [AuditLogEvent.StickerCreate],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.StickerCreate]: 'إنشاء ستيكر' },
  },
  {
    key: 'sticker_update',
    name: 'تعديل الستيكر',
    emoji: '🖌️',
    description: 'تعديل ستيكرات متعددة بسرعة',
    category: 'التعبيرات',
    severity: 'medium',
    events: [AuditLogEvent.StickerUpdate],
    defaultLimit: 5,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: true,
    eventLabels: { [AuditLogEvent.StickerUpdate]: 'تعديل ستيكر' },
  },

  // --------------------------------------------
  // 🧵 القنوات والثريدات
  // --------------------------------------------
  {
    key: 'channel_settings',
    name: 'إعدادات القنوات',
    emoji: '⚙️',
    description: 'تعديل إعدادات قنوات (الموضوع/الوصف/الوضع البطيء/NSFW...)',
    category: 'القنوات',
    severity: 'high',
    events: [AuditLogEvent.ChannelUpdate],
    defaultLimit: 10,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: true,
    match: (entry) => changeKeys(entry).some((k) => k !== 'name'),
    eventLabels: { [AuditLogEvent.ChannelUpdate]: 'تعديل إعدادات قناة' },
  },
  {
    key: 'channel_overwrites',
    name: 'صلاحيات القنوات',
    emoji: '🔐',
    description: 'إنشاء/تعديل/حذف استثناءات صلاحيات القنوات بشكل جماعي',
    category: 'القنوات',
    severity: 'critical',
    events: [
      AuditLogEvent.ChannelOverwriteCreate,
      AuditLogEvent.ChannelOverwriteUpdate,
      AuditLogEvent.ChannelOverwriteDelete,
    ],
    defaultLimit: 10,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: false,
    eventLabels: {
      [AuditLogEvent.ChannelOverwriteCreate]: 'إنشاء استثناء صلاحيات',
      [AuditLogEvent.ChannelOverwriteUpdate]: 'تعديل استثناء صلاحيات',
      [AuditLogEvent.ChannelOverwriteDelete]: 'حذف استثناء صلاحيات',
    },
  },
  {
    key: 'message_delete_mass',
    name: 'حذف الرسائل الفردي',
    emoji: '🧹',
    description: 'حذف رسائل كثيرة فرادى بسرعة (تفادي كشف الحذف الجماعي)',
    category: 'القنوات',
    severity: 'high',
    events: [AuditLogEvent.MessageDelete],
    defaultLimit: 20,
    defaultWindowSeconds: 10,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.MessageDelete]: 'حذف رسائل متكرر' },
  },
  {
    key: 'thread_update',
    name: 'تعديل الثريدات',
    emoji: '🧵',
    description: 'تعديل/إغلاق/فتح ثريدات متعددة بسرعة',
    category: 'القنوات',
    severity: 'medium',
    events: [AuditLogEvent.ThreadUpdate],
    defaultLimit: 8,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.ThreadUpdate]: 'تعديل ثريد' },
  },
  {
    key: 'message_pin',
    name: 'تثبيت الرسائل',
    emoji: '📌',
    description: 'تثبيت رسائل متعددة بسرعة',
    category: 'القنوات',
    severity: 'low',
    events: [AuditLogEvent.MessagePin],
    defaultLimit: 5,
    defaultWindowSeconds: 30,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.MessagePin]: 'تثبيت رسالة' },
  },
  {
    key: 'message_unpin',
    name: 'إلغاء تثبيت الرسائل',
    emoji: '📍',
    description: 'إلغاء تثبيت رسائل متعددة بسرعة',
    category: 'القنوات',
    severity: 'low',
    events: [AuditLogEvent.MessageUnpin],
    defaultLimit: 5,
    defaultWindowSeconds: 30,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.MessageUnpin]: 'إلغاء تثبيت رسالة' },
  },
  {
    key: 'voice_status',
    name: 'حالات القنوات الصوتية',
    emoji: '🔊',
    description: 'إنشاء/حذف حالات القنوات الصوتية بشكل متكرر',
    category: 'القنوات',
    severity: 'low',
    events: [AuditLogEvent.VoiceChannelStatusCreate, AuditLogEvent.VoiceChannelStatusDelete],
    defaultLimit: 5,
    defaultWindowSeconds: 30,
    defaultAction: 'alert',
    minor: true,
  },

  // --------------------------------------------
  // 🎭 الرولات
  // --------------------------------------------
  {
    key: 'role_settings',
    name: 'إعدادات الرولات',
    emoji: '🎭',
    description: 'تعديل خصائص الرولات (اللون/الترتيب/الإظهار/الإشارة)',
    category: 'الرولات',
    severity: 'medium',
    events: [AuditLogEvent.RoleUpdate],
    defaultLimit: 10,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: true,
    match: (entry) => changeKeys(entry).some((k) => !['name', 'permissions'].includes(k)),
    eventLabels: { [AuditLogEvent.RoleUpdate]: 'تعديل إعدادات رول' },
  },

  // --------------------------------------------
  // 🔗 الويب هوكس والتكاملات
  // --------------------------------------------
  {
    key: 'webhook_delete',
    name: 'حذف الويب هوك',
    emoji: '🧨',
    description: 'حذف ويب هوك متعددة بسرعة (قد يخفي أثر اختراق)',
    category: 'التكاملات',
    severity: 'high',
    events: [AuditLogEvent.WebhookDelete],
    defaultLimit: 3,
    defaultWindowSeconds: 120,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.WebhookDelete]: 'حذف ويب هوك' },
  },
  {
    key: 'integration_create',
    name: 'إنشاء تكامل',
    emoji: '🔌',
    description: 'ربط تكامل/تطبيق خارجي بالسيرفر',
    category: 'التكاملات',
    severity: 'critical',
    events: [AuditLogEvent.IntegrationCreate],
    defaultLimit: 1,
    defaultWindowSeconds: 300,
    defaultAction: 'alert',
    minor: false,
    eventLabels: { [AuditLogEvent.IntegrationCreate]: 'إنشاء تكامل' },
  },
  {
    key: 'integration_update',
    name: 'تعديل تكامل',
    emoji: '🛠️',
    description: 'تعديل تكامل/تطبيق خارجي مرتبط بالسيرفر',
    category: 'التكاملات',
    severity: 'critical',
    events: [AuditLogEvent.IntegrationUpdate],
    defaultLimit: 1,
    defaultWindowSeconds: 300,
    defaultAction: 'alert',
    minor: false,
    eventLabels: { [AuditLogEvent.IntegrationUpdate]: 'تعديل تكامل' },
  },
  {
    key: 'integration_delete',
    name: 'حذف تكامل',
    emoji: '⛔',
    description: 'فصل تكامل/تطبيق خارجي عن السيرفر',
    category: 'التكاملات',
    severity: 'high',
    events: [AuditLogEvent.IntegrationDelete],
    defaultLimit: 1,
    defaultWindowSeconds: 300,
    defaultAction: 'alert',
    minor: false,
    eventLabels: { [AuditLogEvent.IntegrationDelete]: 'حذف تكامل' },
  },
  {
    key: 'app_command_permissions',
    name: 'صلاحيات أوامر التطبيقات',
    emoji: '🔐',
    description: 'تعديل صلاحيات أوامر التطبيقات (قد يفتح أبواباً خفية)',
    category: 'التكاملات',
    severity: 'critical',
    events: [AuditLogEvent.ApplicationCommandPermissionUpdate],
    defaultLimit: 1,
    defaultWindowSeconds: 300,
    defaultAction: 'alert',
    minor: false,
    eventLabels: { [AuditLogEvent.ApplicationCommandPermissionUpdate]: 'تعديل صلاحيات أوامر التطبيقات' },
  },

  // --------------------------------------------
  // 🤖 الأتمتة
  // --------------------------------------------
  {
    key: 'automod_create',
    name: 'إنشاء قاعدة أوتومود',
    emoji: '🤖',
    description: 'إنشاء قاعدة AutoMod جديدة (قد تُستخدم لتقييد الأعضاء)',
    category: 'الأتمتة',
    severity: 'critical',
    events: [AuditLogEvent.AutoModerationRuleCreate],
    defaultLimit: 5,
    defaultWindowSeconds: 300,
    defaultAction: 'alert',
    minor: false,
    eventLabels: { [AuditLogEvent.AutoModerationRuleCreate]: 'إنشاء قاعدة أوتومود' },
  },
  {
    key: 'automod_update',
    name: 'تعديل قاعدة أوتومود',
    emoji: '⚙️',
    description: 'تعديل قواعد AutoMod (تعطيل الحماية أو تقييد الأعضاء)',
    category: 'الأتمتة',
    severity: 'critical',
    events: [AuditLogEvent.AutoModerationRuleUpdate],
    defaultLimit: 2,
    defaultWindowSeconds: 300,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.AutoModerationRuleUpdate]: 'تعديل قاعدة أوتومود' },
  },
  {
    key: 'automod_delete',
    name: 'حذف قاعدة أوتومود',
    emoji: '🗑️',
    description: 'حذف قواعد AutoMod (فتح الباب للسبام)',
    category: 'الأتمتة',
    severity: 'critical',
    events: [AuditLogEvent.AutoModerationRuleDelete],
    defaultLimit: 1,
    defaultWindowSeconds: 300,
    defaultAction: 'ban',
    minor: false,
    eventLabels: { [AuditLogEvent.AutoModerationRuleDelete]: 'حذف قاعدة أوتومود' },
  },

  // --------------------------------------------
  // 📅 الأحداث والمراحل
  // --------------------------------------------
  {
    key: 'stage_create',
    name: 'إنشاء مرحلة',
    emoji: '🎙️',
    description: 'إنشاء Stage Channels',
    category: 'الأحداث',
    severity: 'low',
    events: [AuditLogEvent.StageInstanceCreate],
    defaultLimit: 3,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.StageInstanceCreate]: 'إنشاء مرحلة' },
  },
  {
    key: 'stage_update',
    name: 'تعديل مرحلة',
    emoji: '🎚️',
    description: 'تعديل Stage Channels',
    category: 'الأحداث',
    severity: 'low',
    events: [AuditLogEvent.StageInstanceUpdate],
    defaultLimit: 3,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.StageInstanceUpdate]: 'تعديل مرحلة' },
  },
  {
    key: 'stage_delete',
    name: 'حذف مرحلة',
    emoji: '🎬',
    description: 'حذف Stage Channels بشكل متكرر',
    category: 'الأحداث',
    severity: 'medium',
    events: [AuditLogEvent.StageInstanceDelete],
    defaultLimit: 2,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.StageInstanceDelete]: 'حذف مرحلة' },
  },
  {
    key: 'scheduled_event_create',
    name: 'إنشاء حدث مجدول',
    emoji: '📅',
    description: 'إنشاء أحداث مجدولة متعددة',
    category: 'الأحداث',
    severity: 'low',
    events: [AuditLogEvent.GuildScheduledEventCreate],
    defaultLimit: 3,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.GuildScheduledEventCreate]: 'إنشاء حدث مجدول' },
  },
  {
    key: 'scheduled_event_update',
    name: 'تعديل حدث مجدول',
    emoji: '🗓️',
    description: 'تعديل أحداث مجدولة متعددة',
    category: 'الأحداث',
    severity: 'low',
    events: [AuditLogEvent.GuildScheduledEventUpdate],
    defaultLimit: 3,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.GuildScheduledEventUpdate]: 'تعديل حدث مجدول' },
  },
  {
    key: 'scheduled_event_delete',
    name: 'حذف حدث مجدول',
    emoji: '❌',
    description: 'حذف أحداث مجدولة متعددة',
    category: 'الأحداث',
    severity: 'medium',
    events: [AuditLogEvent.GuildScheduledEventDelete],
    defaultLimit: 2,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.GuildScheduledEventDelete]: 'حذف حدث مجدول' },
  },

  // --------------------------------------------
  // 🔊 الصوت
  // --------------------------------------------
  {
    key: 'soundboard_create',
    name: 'إنشاء صوت لوحة',
    emoji: '🎵',
    description: 'إضافة أصوات للوحة الصوت (Soundboard)',
    category: 'الصوت',
    severity: 'low',
    events: [AuditLogEvent.SoundboardSoundCreate],
    defaultLimit: 3,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.SoundboardSoundCreate]: 'إنشاء صوت لوحة' },
  },
  {
    key: 'soundboard_update',
    name: 'تعديل صوت لوحة',
    emoji: '🎶',
    description: 'تعديل أصوات لوحة الصوت',
    category: 'الصوت',
    severity: 'low',
    events: [AuditLogEvent.SoundboardSoundUpdate],
    defaultLimit: 3,
    defaultWindowSeconds: 60,
    defaultAction: 'alert',
    minor: true,
    eventLabels: { [AuditLogEvent.SoundboardSoundUpdate]: 'تعديل صوت لوحة' },
  },
  {
    key: 'soundboard_delete',
    name: 'حذف صوت لوحة',
    emoji: '🔇',
    description: 'حذف أصوات لوحة الصوت بشكل متكرر',
    category: 'الصوت',
    severity: 'medium',
    events: [AuditLogEvent.SoundboardSoundDelete],
    defaultLimit: 2,
    defaultWindowSeconds: 60,
    defaultAction: 'strip',
    minor: false,
    eventLabels: { [AuditLogEvent.SoundboardSoundDelete]: 'حذف صوت لوحة' },
  },
];

const BY_KEY = new Map(SECURITY_MODULES.map((m) => [m.key, m]));
const BY_EVENT = new Map<number, SecurityModuleDefinition[]>();
for (const mod of SECURITY_MODULES) {
  for (const event of mod.events) {
    const list = BY_EVENT.get(event) || [];
    list.push(mod);
    BY_EVENT.set(event, list);
  }
}

export function getSecurityModule(key: string): SecurityModuleDefinition | undefined {
  return BY_KEY.get(String(key));
}

export function securityModulesForEvent(action: number): SecurityModuleDefinition[] {
  return BY_EVENT.get(action) || [];
}

export const SECURITY_MODULE_KEYS = SECURITY_MODULES.map((m) => m.key);

export const SECURITY_CATEGORIES = Array.from(new Set(SECURITY_MODULES.map((m) => m.category)));

export const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  critical: 'حرجة جداً 🔴',
  high: 'عالية 🟠',
  medium: 'متوسطة 🟡',
  low: 'منخفضة 🟢',
};

export function moduleDefaultConfig(mod: SecurityModuleDefinition): {
  enabled: boolean;
  limit: number;
  windowSeconds: number;
  action: SecurityAction;
} {
  return {
    enabled: true,
    limit: mod.defaultLimit,
    windowSeconds: mod.defaultWindowSeconds,
    action: mod.defaultAction,
  };
}
