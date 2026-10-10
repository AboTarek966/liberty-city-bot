// ============================================
// Liberty City Bot - Interaction Handler
// ============================================

import {
  Client,
  Collection,
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/helpers';

const logger = createLogger('InteractionHandler');

// --------------------------------------------
// Types
// --------------------------------------------
export interface ButtonHandler {
  id: string;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}

export interface ModalHandler {
  id: string;
  execute: (interaction: ModalSubmitInteraction) => Promise<void>;
}

export interface SelectMenuHandler {
  id: string;
  execute: (interaction: StringSelectMenuInteraction | UserSelectMenuInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction) => Promise<void>;
}

export class InteractionHandler {
  private client: Client;
  private buttons: Map<string, ButtonHandler>;
  private modals: Map<string, ModalHandler>;
  private selectMenus: Map<string, SelectMenuHandler>;

  constructor(client: Client) {
    this.client = client;
    this.buttons = new Map();
    this.modals = new Map();
    this.selectMenus = new Map();
  }

  // --------------------------------------------
  // Load Interactions
  // --------------------------------------------
  async loadInteractions(): Promise<void> {
    const interactionsPath = path.join(__dirname, '../interactions');

    if (!fs.existsSync(interactionsPath)) {
      logger.info('No interactions directory found, skipping');
      return;
    }

    const folders = fs.readdirSync(interactionsPath).filter(dir => {
      return fs.statSync(path.join(interactionsPath, dir)).isDirectory();
    });

    let loadedCount = 0;

    // Load buttons
    const buttonsPath = path.join(interactionsPath, 'buttons');
    if (fs.existsSync(buttonsPath)) {
      const buttonFiles = fs.readdirSync(buttonsPath).filter(f => (f.endsWith('.js') && !f.endsWith('.d.js')));
      for (const file of buttonFiles) {
        try {
          const filePath = path.join(buttonsPath, file);
          const buttonModule = require(filePath);
          const button: ButtonHandler = buttonModule.default || buttonModule;
          
          if (button.id) {
            this.buttons.set(button.id, button);
            loadedCount++;
          }
        } catch (error) {
          logger.error(`Failed to load button ${file}:`, error);
        }
      }
    }

    // Load modals
    const modalsPath = path.join(interactionsPath, 'modals');
    if (fs.existsSync(modalsPath)) {
      const modalFiles = fs.readdirSync(modalsPath).filter(f => (f.endsWith('.js') && !f.endsWith('.d.js')));
      for (const file of modalFiles) {
        try {
          const filePath = path.join(modalsPath, file);
          const modalModule = require(filePath);
          const modal: ModalHandler = modalModule.default || modalModule;
          
          if (modal.id) {
            this.modals.set(modal.id, modal);
            loadedCount++;
          }
        } catch (error) {
          logger.error(`Failed to load modal ${file}:`, error);
        }
      }
    }

    // Load select menus
    const selectMenusPath = path.join(interactionsPath, 'selectMenus');
    if (fs.existsSync(selectMenusPath)) {
      const selectFiles = fs.readdirSync(selectMenusPath).filter(f => (f.endsWith('.js') && !f.endsWith('.d.js')));
      for (const file of selectFiles) {
        try {
          const filePath = path.join(selectMenusPath, file);
          const selectModule = require(filePath);
          const selectMenu: SelectMenuHandler = selectModule.default || selectModule;
          
          if (selectMenu.id) {
            this.selectMenus.set(selectMenu.id, selectMenu);
            loadedCount++;
          }
        } catch (error) {
          logger.error(`Failed to load select menu ${file}:`, error);
        }
      }
    }

    logger.info(`Loaded ${loadedCount} interactions (buttons: ${this.buttons.size}, modals: ${this.modals.size}, select menus: ${this.selectMenus.size})`);
  }

  // --------------------------------------------
  // Handle Interaction
  // --------------------------------------------
  async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      // Buttons
      if (interaction.isButton()) {
        await this.handleButton(interaction);
        return;
      }

      // Modals
      if (interaction.isModalSubmit()) {
        await this.handleModal(interaction);
        return;
      }

      // Select Menus
      if (
        interaction.isStringSelectMenu() ||
        interaction.isUserSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isChannelSelectMenu()
      ) {
        await this.handleSelectMenu(interaction);
        return;
      }

      // Autocomplete
      if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
        return;
      }

      // Slash Commands
      if (interaction.isChatInputCommand()) {
        // Handled by CommandHandler
        return;
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      const errorReply = {
        content: '❌ حدث خطأ أثناء معالجة التفاعل',
        ephemeral: true,
      };

      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply).catch(() => {});
        } else {
          await interaction.reply(errorReply).catch(() => {});
        }
      }
    }
  }

  // --------------------------------------------
  // Handle Button
  // --------------------------------------------
  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const buttonId = interaction.customId;
    
    // Try exact match first
    let handler = this.buttons.get(buttonId);
    
    // If not found, try prefix matching (e.g., "ticket_close_123" matches "ticket_close")
    // Prefer the LONGEST matching id so a generic id never shadows a more specific one
    if (!handler) {
      let bestLength = 0;
      for (const [id, btnHandler] of this.buttons) {
        if (buttonId.startsWith(id) && id.length > bestLength) {
          handler = btnHandler;
          bestLength = id.length;
        }
      }
    }

    if (handler) {
      await handler.execute(interaction);
    } else {
      logger.debug(`No button handler for: ${buttonId}`);
      await interaction.reply({
        content: '❌ هذا الزر غير متاح',
        ephemeral: true,
      }).catch(() => {});
    }
  }

  // --------------------------------------------
  // Handle Modal
  // --------------------------------------------
  private async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const modalId = interaction.customId;
    
    let handler = this.modals.get(modalId);
    
    // Prefer the LONGEST matching id so a generic id never shadows a more specific one
    if (!handler) {
      let bestLength = 0;
      for (const [id, modalHandler] of this.modals) {
        if (modalId.startsWith(id) && id.length > bestLength) {
          handler = modalHandler;
          bestLength = id.length;
        }
      }
    }

    if (handler) {
      await handler.execute(interaction);
    } else {
      logger.debug(`No modal handler for: ${modalId}`);
      await interaction.reply({
        content: '❌ هذا النموذج غير متاح',
        ephemeral: true,
      }).catch(() => {});
    }
  }

  // --------------------------------------------
  // Handle Select Menu
  // --------------------------------------------
  private async handleSelectMenu(
    interaction: StringSelectMenuInteraction | UserSelectMenuInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction
  ): Promise<void> {
    const menuId = interaction.customId;
    
    let handler = this.selectMenus.get(menuId);
    
    // Prefer the LONGEST matching id so a generic id never shadows a more specific one
    if (!handler) {
      let bestLength = 0;
      for (const [id, menuHandler] of this.selectMenus) {
        if (menuId.startsWith(id) && id.length > bestLength) {
          handler = menuHandler;
          bestLength = id.length;
        }
      }
    }

    if (handler) {
      await handler.execute(interaction);
    } else {
      logger.debug(`No select menu handler for: ${menuId}`);
      await interaction.reply({
        content: '❌ هذا القائمة غير متاحة',
        ephemeral: true,
      }).catch(() => {});
    }
  }

  // --------------------------------------------
  // Handle Autocomplete
  // --------------------------------------------
  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    // Handled by CommandHandler
    // This is a fallback
  }

  // --------------------------------------------
  // Register Handlers Dynamically
  // --------------------------------------------
  registerButton(handler: ButtonHandler): void {
    this.buttons.set(handler.id, handler);
  }

  registerModal(handler: ModalHandler): void {
    this.modals.set(handler.id, handler);
  }

  registerSelectMenu(handler: SelectMenuHandler): void {
    this.selectMenus.set(handler.id, handler);
  }

  // --------------------------------------------
  // Getters
  // --------------------------------------------
  getButtons(): Map<string, ButtonHandler> {
    return this.buttons;
  }

  getModals(): Map<string, ModalHandler> {
    return this.modals;
  }

  getSelectMenus(): Map<string, SelectMenuHandler> {
    return this.selectMenus;
  }
}

export default InteractionHandler;