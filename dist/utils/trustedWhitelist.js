"use strict";
// ============================================
// Omni Bot — Trusted Whitelist
// الوايت ليست الموثوقة: مساحة محدودة تحت الحماية، مالك السيرفر فقط.
// ليست حصانة — أي تجاوز للحدود يُعاقب كأي مخالفة عادية.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TRUSTED_WHITELIST = void 0;
exports.getTrustedWhitelistConfig = getTrustedWhitelistConfig;
exports.isTrustedWhitelistMember = isTrustedWhitelistMember;
exports.isMinorAuditEvent = isMinorAuditEvent;
exports.auditEventAllowanceKind = auditEventAllowanceKind;
exports.auditEventLabel = auditEventLabel;
const discord_js_1 = require("discord.js");
exports.DEFAULT_TRUSTED_WHITELIST = {
    enabled: true,
    userIds: [],
    minorActions: 3,
    minorWindowSeconds: 300,
    criticalActions: 1,
    criticalWindowSeconds: 600,
    allowDestructive: false,
};
const clampInt = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
};
/** قراءة إعدادات الوايت ليست الموثوقة مع قيم افتراضية آمنة */
function getTrustedWhitelistConfig(settings) {
    const raw = settings?.protection?.trustedWhitelist || {};
    return {
        enabled: raw.enabled !== false,
        userIds: Array.isArray(raw.userIds) ? raw.userIds.map(String) : [],
        minorActions: clampInt(raw.minorActions, exports.DEFAULT_TRUSTED_WHITELIST.minorActions, 0, 50),
        minorWindowSeconds: clampInt(raw.minorWindowSeconds, exports.DEFAULT_TRUSTED_WHITELIST.minorWindowSeconds, 10, 86400),
        criticalActions: clampInt(raw.criticalActions, exports.DEFAULT_TRUSTED_WHITELIST.criticalActions, 0, 10),
        criticalWindowSeconds: clampInt(raw.criticalWindowSeconds, exports.DEFAULT_TRUSTED_WHITELIST.criticalWindowSeconds, 30, 86400),
        allowDestructive: raw.allowDestructive === true,
        logChannel: raw.logChannel ? String(raw.logChannel) : undefined,
    };
}
/** هل العضو موجود في الوايت ليست الموثوقة؟ (لا يفحص البوتات — يفحصها المستدعي) */
function isTrustedWhitelistMember(settings, userId) {
    if (!userId)
        return false;
    const cfg = getTrustedWhitelistConfig(settings);
    return cfg.enabled && cfg.userIds.includes(String(userId));
}
// --------------------------------------------
// تصنيف أحداث سجل التدقيق
// --------------------------------------------
const MINOR_EVENTS = new Set([
    discord_js_1.AuditLogEvent.ChannelCreate,
    discord_js_1.AuditLogEvent.RoleCreate,
    discord_js_1.AuditLogEvent.ThreadCreate,
    discord_js_1.AuditLogEvent.ChannelUpdate,
    discord_js_1.AuditLogEvent.ThreadUpdate,
    discord_js_1.AuditLogEvent.EmojiCreate,
    discord_js_1.AuditLogEvent.EmojiUpdate,
    discord_js_1.AuditLogEvent.StickerCreate,
    discord_js_1.AuditLogEvent.StickerUpdate,
    discord_js_1.AuditLogEvent.InviteCreate,
    discord_js_1.AuditLogEvent.InviteUpdate,
    discord_js_1.AuditLogEvent.InviteDelete,
    discord_js_1.AuditLogEvent.MessagePin,
    discord_js_1.AuditLogEvent.MessageUnpin,
    discord_js_1.AuditLogEvent.StageInstanceCreate,
    discord_js_1.AuditLogEvent.StageInstanceUpdate,
    discord_js_1.AuditLogEvent.GuildScheduledEventCreate,
    discord_js_1.AuditLogEvent.GuildScheduledEventUpdate,
    discord_js_1.AuditLogEvent.SoundboardSoundCreate,
    discord_js_1.AuditLogEvent.SoundboardSoundUpdate,
    discord_js_1.AuditLogEvent.VoiceChannelStatusCreate,
    discord_js_1.AuditLogEvent.VoiceChannelStatusDelete,
    discord_js_1.AuditLogEvent.MemberMove,
]);
/** هل الحدث خفيف (إنشاء/تعديل غير مدمّر)؟ */
function isMinorAuditEvent(action) {
    return MINOR_EVENTS.has(action);
}
/** تصنيف مبسّط للاستخدام في منح المساحة */
function auditEventAllowanceKind(action) {
    return isMinorAuditEvent(action) ? 'minor' : 'critical';
}
/** اسم عربي مختصر لحدث تدقيق (للتنبيهات والسجلات) */
const AUDIT_LABELS = {
    [discord_js_1.AuditLogEvent.GuildUpdate]: 'تعديل إعدادات السيرفر',
    [discord_js_1.AuditLogEvent.ChannelCreate]: 'إنشاء قناة',
    [discord_js_1.AuditLogEvent.ChannelUpdate]: 'تعديل قناة',
    [discord_js_1.AuditLogEvent.ChannelDelete]: 'حذف قناة',
    [discord_js_1.AuditLogEvent.ChannelOverwriteCreate]: 'إنشاء استثناء صلاحيات',
    [discord_js_1.AuditLogEvent.ChannelOverwriteUpdate]: 'تعديل استثناء صلاحيات',
    [discord_js_1.AuditLogEvent.ChannelOverwriteDelete]: 'حذف استثناء صلاحيات',
    [discord_js_1.AuditLogEvent.MemberKick]: 'طرد عضو',
    [discord_js_1.AuditLogEvent.MemberPrune]: 'تنظيف أعضاء',
    [discord_js_1.AuditLogEvent.MemberBanAdd]: 'حظر عضو',
    [discord_js_1.AuditLogEvent.MemberBanRemove]: 'رفع حظر عضو',
    [discord_js_1.AuditLogEvent.MemberUpdate]: 'تعديل بيانات عضو',
    [discord_js_1.AuditLogEvent.MemberRoleUpdate]: 'تعديل رولات عضو',
    [discord_js_1.AuditLogEvent.MemberMove]: 'نقل عضو صوتياً',
    [discord_js_1.AuditLogEvent.MemberDisconnect]: 'فصل عضو صوتياً',
    [discord_js_1.AuditLogEvent.RoleCreate]: 'إنشاء رول',
    [discord_js_1.AuditLogEvent.RoleUpdate]: 'تعديل رول',
    [discord_js_1.AuditLogEvent.RoleDelete]: 'حذف رول',
    [discord_js_1.AuditLogEvent.InviteCreate]: 'إنشاء دعوة',
    [discord_js_1.AuditLogEvent.InviteUpdate]: 'تعديل دعوة',
    [discord_js_1.AuditLogEvent.InviteDelete]: 'حذف دعوة',
    [discord_js_1.AuditLogEvent.WebhookCreate]: 'إنشاء ويب هوك',
    [discord_js_1.AuditLogEvent.WebhookUpdate]: 'تعديل ويب هوك',
    [discord_js_1.AuditLogEvent.WebhookDelete]: 'حذف ويب هوك',
    [discord_js_1.AuditLogEvent.EmojiCreate]: 'إنشاء إيموجي',
    [discord_js_1.AuditLogEvent.EmojiUpdate]: 'تعديل إيموجي',
    [discord_js_1.AuditLogEvent.EmojiDelete]: 'حذف إيموجي',
    [discord_js_1.AuditLogEvent.MessageBulkDelete]: 'حذف رسائل جماعي',
    [discord_js_1.AuditLogEvent.MessagePin]: 'تثبيت رسالة',
    [discord_js_1.AuditLogEvent.MessageUnpin]: 'إلغاء تثبيت رسالة',
    [discord_js_1.AuditLogEvent.IntegrationCreate]: 'إنشاء تكامل',
    [discord_js_1.AuditLogEvent.IntegrationUpdate]: 'تعديل تكامل',
    [discord_js_1.AuditLogEvent.IntegrationDelete]: 'حذف تكامل',
    [discord_js_1.AuditLogEvent.StageInstanceCreate]: 'إنشاء مرحلة',
    [discord_js_1.AuditLogEvent.StageInstanceUpdate]: 'تعديل مرحلة',
    [discord_js_1.AuditLogEvent.StageInstanceDelete]: 'حذف مرحلة',
    [discord_js_1.AuditLogEvent.StickerCreate]: 'إنشاء ستيكر',
    [discord_js_1.AuditLogEvent.StickerUpdate]: 'تعديل ستيكر',
    [discord_js_1.AuditLogEvent.StickerDelete]: 'حذف ستيكر',
    [discord_js_1.AuditLogEvent.GuildScheduledEventCreate]: 'إنشاء حدث مجدول',
    [discord_js_1.AuditLogEvent.GuildScheduledEventUpdate]: 'تعديل حدث مجدول',
    [discord_js_1.AuditLogEvent.GuildScheduledEventDelete]: 'حذف حدث مجدول',
    [discord_js_1.AuditLogEvent.ThreadCreate]: 'إنشاء ثريد',
    [discord_js_1.AuditLogEvent.ThreadUpdate]: 'تعديل ثريد',
    [discord_js_1.AuditLogEvent.ThreadDelete]: 'حذف ثريد',
    [discord_js_1.AuditLogEvent.ApplicationCommandPermissionUpdate]: 'تعديل صلاحيات أوامر التطبيقات',
    [discord_js_1.AuditLogEvent.SoundboardSoundCreate]: 'إنشاء صوت لوحة',
    [discord_js_1.AuditLogEvent.SoundboardSoundUpdate]: 'تعديل صوت لوحة',
    [discord_js_1.AuditLogEvent.SoundboardSoundDelete]: 'حذف صوت لوحة',
    [discord_js_1.AuditLogEvent.AutoModerationRuleCreate]: 'إنشاء قاعدة أوتومود',
    [discord_js_1.AuditLogEvent.AutoModerationRuleUpdate]: 'تعديل قاعدة أوتومود',
    [discord_js_1.AuditLogEvent.AutoModerationRuleDelete]: 'حذف قاعدة أوتومود',
    [discord_js_1.AuditLogEvent.OnboardingCreate]: 'إنشاء إعدادات ترحيب',
    [discord_js_1.AuditLogEvent.OnboardingUpdate]: 'تعديل إعدادات ترحيب',
    [discord_js_1.AuditLogEvent.OnboardingPromptCreate]: 'إنشاء سؤال ترحيب',
    [discord_js_1.AuditLogEvent.OnboardingPromptUpdate]: 'تعديل سؤال ترحيب',
    [discord_js_1.AuditLogEvent.OnboardingPromptDelete]: 'حذف سؤال ترحيب',
    [discord_js_1.AuditLogEvent.HomeSettingsCreate]: 'إنشاء إعدادات الصفحة الرئيسية',
    [discord_js_1.AuditLogEvent.HomeSettingsUpdate]: 'تعديل إعدادات الصفحة الرئيسية',
    [discord_js_1.AuditLogEvent.VoiceChannelStatusCreate]: 'إنشاء حالة قناة صوتية',
    [discord_js_1.AuditLogEvent.VoiceChannelStatusDelete]: 'حذف حالة قناة صوتية',
};
function auditEventLabel(action) {
    return AUDIT_LABELS[action] || `حدث أمني (${action})`;
}
//# sourceMappingURL=trustedWhitelist.js.map