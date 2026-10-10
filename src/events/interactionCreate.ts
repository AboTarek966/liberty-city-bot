// ============================================
// Liberty City Bot - Interaction Create Event
// ============================================

import { Interaction, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';

const logger = createLogger('Event:InteractionCreate');

const event: Event = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    const client = interaction.client as LibertyClient;

    try {
      // Handle Slash Commands
      if (interaction.isChatInputCommand()) {
        await client.commandHandler.handleCommand(interaction as ChatInputCommandInteraction);
        return;
      }

      // Handle Autocomplete
      if (interaction.isAutocomplete()) {
        await client.commandHandler.handleAutocomplete(interaction as AutocompleteInteraction);
        return;
      }

      // Handle other interactions (buttons, modals, select menus)
      await client.interactionHandler.handleInteraction(interaction);
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      if (interaction.isRepliable()) {
        const errorReply = {
          content: '❌ حدث خطأ غير متوقع',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply).catch(() => {});
        } else {
          await interaction.reply(errorReply).catch(() => {});
        }
      }
    }
  },
};

export default event;