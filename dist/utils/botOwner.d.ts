import type { Client, Guild } from 'discord.js';
/**
 * ⚡ فحص متزامن: هل المستخدم مالك/مطوّر البوت؟
 * يفحص OWNER_ID وDEVELOPER_USER_ID، وأيضاً مالك التطبيق المخزّن بعد الإقلاع.
 * لا يحتاج client ولا اتصالاً بديسكورد وقت الاستدعاء.
 */
export declare function isEnvBotOwner(userId: string | null | undefined): boolean;
export declare function getBotOwnerIds(client: Client): Promise<string[]>;
export declare function isBotOwner(client: Client, userId: string): Promise<boolean>;
/**
 * 👑 مالك/مطوّر البوت أو مالك السيرفر — البوابة الموحّدة للصلاحيات الإدارية العليا.
 * تُستخدم حيث يجب أن يتصرف المطوّر تماماً مثل صاحب السيرفر حتى بدون ملكية.
 */
export declare function isBotOwnerOrGuildOwner(client: Client, guild: Guild | null | undefined, userId: string): Promise<boolean>;
/** نسخة متزامنة تعتمد على البيئة فقط + مالك السيرفر (للدوال غير async) */
export declare function isBotOwnerOrGuildOwnerSync(guild: Guild | null | undefined, userId: string | null | undefined): boolean;
//# sourceMappingURL=botOwner.d.ts.map