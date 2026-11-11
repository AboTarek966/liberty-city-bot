import { Guild } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
/** 🤖 إضافة/إزالة بوت من الوايت ليست (الاستثناء الوقائي) = حصري لمالك البوت (DEVELOPER_USER_ID) أو مالك السيرفر */
export declare function canManageBotWhitelist(guild: Guild, userId: string): boolean;
declare const command: Command;
export default command;
//# sourceMappingURL=whitelist.d.ts.map