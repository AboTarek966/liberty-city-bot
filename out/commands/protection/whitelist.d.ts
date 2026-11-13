import { Guild, Client } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
/** 🛡️ إدارة الوايت ليست (إضافة/إزالة) = مالك البوت فقط + صاحب أعلى رول في السيرفر */
export declare function canManageWhitelist(client: Client, guild: Guild, userId: string): Promise<boolean>;
declare const command: Command;
export default command;
//# sourceMappingURL=whitelist.d.ts.map