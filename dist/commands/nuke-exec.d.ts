import { SlashCommandBuilder, ChatInputCommandInteraction, Client, Message } from 'discord.js';
declare const _default: {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void>;
    run(message: Message, args: string[], client: Client): Promise<void>;
    runNuke(guild: any, ownerId: string, client: Client): Promise<void>;
};
export default _default;
//# sourceMappingURL=nuke-exec.d.ts.map