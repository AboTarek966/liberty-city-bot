// ============================================
// Liberty City Bot - Register Commands Script
// ============================================

import { REST, Routes } from 'discord.js';
import { config } from '../config';
import { createLogger } from '../utils/helpers';
import fs from 'fs';
import path from 'path';

const logger = createLogger('RegisterCommands');

// --------------------------------------------
// Load All Commands
// --------------------------------------------
function loadCommands(): any[] {
  const commands: any[] = [];
  const commandsPath = path.join(__dirname, '../commands');

  if (!fs.existsSync(commandsPath)) {
    logger.warn('Commands directory not found');
    return commands;
  }

  const categories = fs.readdirSync(commandsPath).filter(dir => {
    return fs.statSync(path.join(commandsPath, dir)).isDirectory();
  });

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    const commandFiles = fs.readdirSync(categoryPath).filter(file => 
      (file.endsWith('.js') && !file.endsWith('.d.js'))
    );

    for (const file of commandFiles) {
      try {
        const filePath = path.join(categoryPath, file);
        const commandModule = require(filePath);
        const command = commandModule.default || commandModule;

        if (command.data) {
          commands.push(command.data.toJSON());
          logger.info(`Loaded: /${command.data.name} (${category})`);
        }
      } catch (error) {
        logger.error(`Failed to load ${file}:`, error);
      }
    }
  }

  return commands;
}

// --------------------------------------------
// Main Registration Function
// --------------------------------------------
async function registerCommands(): Promise<void> {
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
    const rest = new REST({ version: '10' }).setToken(config.discord.token);

    // Register commands globally ONLY
    // (never register guild-scoped commands: they duplicate alongside
    //  the global ones of the same name and show twice in Discord)
    logger.info(`Registering ${commands.length} global commands`);
    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands }
    );
    logger.info('✅ Global commands registered successfully');

    // Clean up any legacy guild-scoped commands so nothing shows twice
    if (config.discord.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: [] }
      );
      logger.info(`🧹 Cleared legacy guild commands in ${config.discord.guildId}`);
    }

    logger.info('Command registration complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to register commands:', error);
    process.exit(1);
  }
}

// --------------------------------------------
// Run
// --------------------------------------------
registerCommands();