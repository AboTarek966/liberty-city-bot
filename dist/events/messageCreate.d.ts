import { Message, StringSelectMenuInteraction } from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
declare const event: Event;
export declare function handleAliasPickSelect(interaction: StringSelectMenuInteraction, sid: string): Promise<boolean>;
export declare function executeAliasCommand(message: Message, client: LibertyClient, commandName: string, args: string[], shortcut: string): Promise<void>;
export default event;
//# sourceMappingURL=messageCreate.d.ts.map