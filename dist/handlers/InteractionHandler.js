"use strict";
// ============================================
// Liberty City Bot - Interaction Handler
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionHandler = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('InteractionHandler');
class InteractionHandler {
    client;
    buttons;
    modals;
    selectMenus;
    constructor(client) {
        this.client = client;
        this.buttons = new Map();
        this.modals = new Map();
        this.selectMenus = new Map();
    }
    // --------------------------------------------
    // Load Interactions
    // --------------------------------------------
    async loadInteractions() {
        const interactionsPath = path_1.default.join(__dirname, '../interactions');
        if (!fs_1.default.existsSync(interactionsPath)) {
            logger.info('No interactions directory found, skipping');
            return;
        }
        const folders = fs_1.default.readdirSync(interactionsPath).filter(dir => {
            return fs_1.default.statSync(path_1.default.join(interactionsPath, dir)).isDirectory();
        });
        let loadedCount = 0;
        // Load buttons
        const buttonsPath = path_1.default.join(interactionsPath, 'buttons');
        if (fs_1.default.existsSync(buttonsPath)) {
            const buttonFiles = fs_1.default.readdirSync(buttonsPath).filter(f => (f.endsWith('.js') && !f.endsWith('.d.js')));
            for (const file of buttonFiles) {
                try {
                    const filePath = path_1.default.join(buttonsPath, file);
                    const buttonModule = require(filePath);
                    const button = buttonModule.default || buttonModule;
                    if (button.id) {
                        this.buttons.set(button.id, button);
                        loadedCount++;
                    }
                }
                catch (error) {
                    logger.error(`Failed to load button ${file}:`, error);
                }
            }
        }
        // Load modals
        const modalsPath = path_1.default.join(interactionsPath, 'modals');
        if (fs_1.default.existsSync(modalsPath)) {
            const modalFiles = fs_1.default.readdirSync(modalsPath).filter(f => (f.endsWith('.js') && !f.endsWith('.d.js')));
            for (const file of modalFiles) {
                try {
                    const filePath = path_1.default.join(modalsPath, file);
                    const modalModule = require(filePath);
                    const modal = modalModule.default || modalModule;
                    if (modal.id) {
                        this.modals.set(modal.id, modal);
                        loadedCount++;
                    }
                }
                catch (error) {
                    logger.error(`Failed to load modal ${file}:`, error);
                }
            }
        }
        // Load select menus
        const selectMenusPath = path_1.default.join(interactionsPath, 'selectMenus');
        if (fs_1.default.existsSync(selectMenusPath)) {
            const selectFiles = fs_1.default.readdirSync(selectMenusPath).filter(f => (f.endsWith('.js') && !f.endsWith('.d.js')));
            for (const file of selectFiles) {
                try {
                    const filePath = path_1.default.join(selectMenusPath, file);
                    const selectModule = require(filePath);
                    const selectMenu = selectModule.default || selectModule;
                    if (selectMenu.id) {
                        this.selectMenus.set(selectMenu.id, selectMenu);
                        loadedCount++;
                    }
                }
                catch (error) {
                    logger.error(`Failed to load select menu ${file}:`, error);
                }
            }
        }
        logger.info(`Loaded ${loadedCount} interactions (buttons: ${this.buttons.size}, modals: ${this.modals.size}, select menus: ${this.selectMenus.size})`);
    }
    // --------------------------------------------
    // Handle Interaction
    // --------------------------------------------
    async handleInteraction(interaction) {
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
            if (interaction.isStringSelectMenu() ||
                interaction.isUserSelectMenu() ||
                interaction.isRoleSelectMenu() ||
                interaction.isChannelSelectMenu()) {
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
        }
        catch (error) {
            logger.error('Error handling interaction:', error);
            const errorReply = {
                content: '❌ حدث خطأ أثناء معالجة التفاعل',
                ephemeral: true,
            };
            if (interaction.isRepliable()) {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorReply).catch(() => { });
                }
                else {
                    await interaction.reply(errorReply).catch(() => { });
                }
            }
        }
    }
    // --------------------------------------------
    // Handle Button
    // --------------------------------------------
    async handleButton(interaction) {
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
        }
        else {
            logger.debug(`No button handler for: ${buttonId}`);
            await interaction.reply({
                content: '❌ هذا الزر غير متاح',
                ephemeral: true,
            }).catch(() => { });
        }
    }
    // --------------------------------------------
    // Handle Modal
    // --------------------------------------------
    async handleModal(interaction) {
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
        }
        else {
            logger.debug(`No modal handler for: ${modalId}`);
            await interaction.reply({
                content: '❌ هذا النموذج غير متاح',
                ephemeral: true,
            }).catch(() => { });
        }
    }
    // --------------------------------------------
    // Handle Select Menu
    // --------------------------------------------
    async handleSelectMenu(interaction) {
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
        }
        else {
            logger.debug(`No select menu handler for: ${menuId}`);
            await interaction.reply({
                content: '❌ هذا القائمة غير متاحة',
                ephemeral: true,
            }).catch(() => { });
        }
    }
    // --------------------------------------------
    // Handle Autocomplete
    // --------------------------------------------
    async handleAutocomplete(interaction) {
        // Handled by CommandHandler
        // This is a fallback
    }
    // --------------------------------------------
    // Register Handlers Dynamically
    // --------------------------------------------
    registerButton(handler) {
        this.buttons.set(handler.id, handler);
    }
    registerModal(handler) {
        this.modals.set(handler.id, handler);
    }
    registerSelectMenu(handler) {
        this.selectMenus.set(handler.id, handler);
    }
    // --------------------------------------------
    // Getters
    // --------------------------------------------
    getButtons() {
        return this.buttons;
    }
    getModals() {
        return this.modals;
    }
    getSelectMenus() {
        return this.selectMenus;
    }
}
exports.InteractionHandler = InteractionHandler;
exports.default = InteractionHandler;
//# sourceMappingURL=InteractionHandler.js.map