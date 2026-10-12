import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
declare const command: Command;
export declare function buildPollEmbed(poll: any, authorName?: string): {
    embed: EmbedBuilder;
    components: ActionRowBuilder<ButtonBuilder>[];
};
export default command;
//# sourceMappingURL=poll.d.ts.map