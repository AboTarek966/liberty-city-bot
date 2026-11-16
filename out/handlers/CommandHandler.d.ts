import { Client, Collection, ChatInputCommandInteraction, AutocompleteInteraction, SlashCommandBuilder, ApplicationCommandOptionType } from 'discord.js';
export interface CommandOption {
    name: string;
    description: string;
    type: ApplicationCommandOptionType;
    required?: boolean;
    choices?: Array<{
        name: string;
        value: string | number;
    }>;
    options?: CommandOption[];
    minValue?: number;
    maxValue?: number;
    channelTypes?: number[];
}
export interface Command {
    data: SlashCommandBuilder | any;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
    category?: string;
    cooldown?: number;
    permissions?: bigint[];
    ownerOnly?: boolean;
    /** يسجّل على كل سيرفر بدل القائمة العالمية (لتجاوز حد ديسكورد العالمي 100 أمر) */
    guildOnly?: boolean;
}
export declare class CommandHandler {
    private client;
    private commands;
    private cooldowns;
    constructor(client: Client);
    loadCommands(): Promise<void>;
    private commandData;
    /** تسجيل الأوامر العالمية — تتجاوز حد ديسكورد (100) فتكون الأوامر guildOnly خارجة عنها */
    registerCommands(clientId: string, token: string, guildId?: string): Promise<void>;
    /** تسجيل الأوامر المخصّصة للسيرفرات فقط — لا تُستبدل الأوامر العالمية */
    registerGuildOnlyCommands(clientId: string, token: string, guildIds: string[]): Promise<void>;
    handleCommand(interaction: ChatInputCommandInteraction): Promise<void>;
    handleAutocomplete(interaction: AutocompleteInteraction): Promise<void>;
    private setCooldown;
    private checkCooldown;
    private getCooldownRemaining;
    getCommands(): Collection<string, Command>;
    getCommand(name: string): Command | undefined;
    getCommandsByCategory(category: string): Command[];
    getCategories(): string[];
}
export default CommandHandler;
//# sourceMappingURL=CommandHandler.d.ts.map