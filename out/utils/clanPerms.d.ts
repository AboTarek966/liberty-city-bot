import { Guild, GuildMember } from 'discord.js';
/** هل المستخدم مخول لإدارة العشائر/المسابقات (نفس سياسة /clan)؟ */
export declare function canManageClans(guild: Guild, userId: string, member?: GuildMember | null, client?: any): Promise<boolean>;
/** رد موحّد عند رفض الوصول لإدارة العشائر */
export declare function clanAccessDeniedMessage(): string;
//# sourceMappingURL=clanPerms.d.ts.map