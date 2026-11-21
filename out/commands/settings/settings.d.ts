import { Client } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
/** هل يملك هذا المستخدم صلاحية استخدام لوحة الإعدادات؟ — مالك السيرفر أو مالك/مطوّر البوت + من سمح له */
export declare function isSettingsAllowed(client: Client, guild: any, userId: string, allowlist: string[]): Promise<boolean>;
declare const command: Command;
export default command;
//# sourceMappingURL=settings.d.ts.map