"use strict";
// ============================================
// Liberty City Bot - Register Commands Script
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("../config");
const helpers_1 = require("../utils/helpers");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger = (0, helpers_1.createLogger)('RegisterCommands');
// --------------------------------------------
// Load All Commands
// --------------------------------------------
function loadCommands() {
    const commands = [];
    const commandsPath = path_1.default.join(__dirname, '../commands');
    if (!fs_1.default.existsSync(commandsPath)) {
        logger.warn('Commands directory not found');
        return commands;
    }
    const categories = fs_1.default.readdirSync(commandsPath).filter(dir => {
        return fs_1.default.statSync(path_1.default.join(commandsPath, dir)).isDirectory();
    });
    for (const category of categories) {
        const categoryPath = path_1.default.join(commandsPath, category);
        const commandFiles = fs_1.default.readdirSync(categoryPath).filter(file => (file.endsWith('.js') && !file.endsWith('.d.js')));
        for (const file of commandFiles) {
            try {
                const filePath = path_1.default.join(categoryPath, file);
                const commandModule = require(filePath);
                const command = commandModule.default || commandModule;
                if (command.data) {
                    commands.push(command.data.toJSON());
                    logger.info(`Loaded: /${command.data.name} (${category})`);
                }
            }
            catch (error) {
                logger.error(`Failed to load ${file}:`, error);
            }
        }
    }
    return commands;
}
// --------------------------------------------
// Main Registration Function
// --------------------------------------------
async function registerCommands() {
    try {
        logger.info('Starting command registration...');
        // Load commands
        const commands = loadCommands();
        logger.info(`Loaded ${commands.length} commands`);
        if (commands.length === 0) {
            logger.warn('No commands to register');
            return;
        }
        // Initialize REST
        const rest = new discord_js_1.REST({ version: '10' }).setToken(config_1.config.discord.token);
        // Register commands
        if (config_1.config.discord.guildId) {
            // Register to specific guild (for testing - instant)
            logger.info(`Registering ${commands.length} guild commands to ${config_1.config.discord.guildId}`);
            await rest.put(discord_js_1.Routes.applicationGuildCommands(config_1.config.discord.clientId, config_1.config.discord.guildId), { body: commands });
            logger.info('✅ Guild commands registered successfully');
        }
        else {
            // Register globally (takes up to 1 hour to propagate)
            logger.info(`Registering ${commands.length} global commands`);
            await rest.put(discord_js_1.Routes.applicationCommands(config_1.config.discord.clientId), { body: commands });
            logger.info('✅ Global commands registered successfully');
        }
        logger.info('Command registration complete!');
        process.exit(0);
    }
    catch (error) {
        logger.error('Failed to register commands:', error);
        process.exit(1);
    }
}
// --------------------------------------------
// Run
// --------------------------------------------
registerCommands();
//# sourceMappingURL=registerCommands.js.map