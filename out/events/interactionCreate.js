"use strict";
// ============================================
// Liberty City Bot - Interaction Create Event
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('Event:InteractionCreate');
const event = {
    name: 'interactionCreate',
    async execute(interaction) {
        const client = interaction.client;
        try {
            // Handle Slash Commands
            if (interaction.isChatInputCommand()) {
                await client.commandHandler.handleCommand(interaction);
                return;
            }
            // Handle Autocomplete
            if (interaction.isAutocomplete()) {
                await client.commandHandler.handleAutocomplete(interaction);
                return;
            }
            // Handle other interactions (buttons, modals, select menus)
            await client.interactionHandler.handleInteraction(interaction);
        }
        catch (error) {
            logger.error('Error handling interaction:', error);
            if (interaction.isRepliable()) {
                const errorReply = {
                    content: '❌ حدث خطأ غير متوقع',
                    ephemeral: true,
                };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorReply).catch(() => { });
                }
                else {
                    await interaction.reply(errorReply).catch(() => { });
                }
            }
        }
    },
};
exports.default = event;
//# sourceMappingURL=interactionCreate.js.map