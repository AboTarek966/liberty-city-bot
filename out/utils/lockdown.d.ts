import { Guild } from 'discord.js';
export interface LockdownResult {
    textChannels: number;
    voiceChannels: number;
}
/**
 * تفعيل/إلغاء وضع الطوارئ في جميع قنوات السيرفر
 * - التفعيل: منع @everyone من الكتابة في النصية + الدخول في الصوتية
 * - الإلغاء: إزالة الصلاحيات الممنوحة (تستعيد الإعدادات الأصلية للقناة)
 */
export declare function setLockdown(guild: Guild, enabled: boolean): Promise<LockdownResult>;
//# sourceMappingURL=lockdown.d.ts.map