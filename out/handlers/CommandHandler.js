"use strict";
// ============================================
// Liberty City Bot - Command Handler
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandHandler = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("../utils/helpers");
const botOwner_1 = require("../utils/botOwner");
const logger = (0, helpers_1.createLogger)('CommandHandler');
class CommandHandler {
    client;
    commands;
    cooldowns;
    constructor(client) {
        this.client = client;
        this.commands = new discord_js_1.Collection();
        this.cooldowns = new discord_js_1.Collection();
    }
    // --------------------------------------------
    // Load Commands
    // --------------------------------------------
    async loadCommands() {
        const commandsPath = path_1.default.join(__dirname, '../commands');
        if (!fs_1.default.existsSync(commandsPath)) {
            logger.warn('Commands directory not found');
            return;
        }
        const categories = fs_1.default.readdirSync(commandsPath).filter(dir => {
            return fs_1.default.statSync(path_1.default.join(commandsPath, dir)).isDirectory();
        });
        let loadedCount = 0;
        for (const category of categories) {
            const categoryPath = path_1.default.join(commandsPath, category);
            const commandFiles = fs_1.default.readdirSync(categoryPath).filter(file => (file.endsWith('.js') && !file.endsWith('.d.js')));
            for (const file of commandFiles) {
                try {
                    const filePath = path_1.default.join(categoryPath, file);
                    const commandModule = require(filePath);
                    const command = commandModule.default || commandModule;
                    if (!command.data || !command.execute) {
                        logger.warn(`Command file ${file} is missing data or execute`);
                        continue;
                    }
                    command.category = category;
                    if (this.commands.has(command.data.name)) {
                        logger.warn(`Duplicate command name "${command.data.name}" in ${file} — overwriting previous definition`);
                    }
                    this.commands.set(command.data.name, command);
                    loadedCount++;
                }
                catch (error) {
                    logger.error(`Failed to load command ${file}:`, error);
                }
            }
        }
        logger.info(`Loaded ${loadedCount} commands from ${categories.length} categories`);
    }
    // --------------------------------------------
    // Register Slash Commands
    // --------------------------------------------
    async registerCommands(clientId, token, guildId) {
        const commandsData = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
        try {
            const rest = new discord_js_1.REST({ version: '10' }).setToken(token);
            logger.info(`Started refreshing ${commandsData.length} slash commands`);
            if (guildId) {
                // NOTE: guild-scoped commands are intentionally NOT used —
                // they duplicate global commands with the same name (shown twice in Discord).
                // Register globally instead, and clear any legacy guild commands.
                await rest.put(discord_js_1.Routes.applicationCommands(clientId), {
                    body: commandsData,
                });
                await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guildId), {
                    body: [],
                });
                logger.info(`Successfully registered global commands (cleared legacy guild commands in ${guildId})`);
            }
            else {
                // Register globally
                await rest.put(discord_js_1.Routes.applicationCommands(clientId), {
                    body: commandsData,
                });
                logger.info('Successfully registered global commands');
            }
        }
        catch (error) {
            logger.error('Failed to register slash commands:', error);
            throw error;
        }
    }
    // --------------------------------------------
    // Handle Command Interaction
    // --------------------------------------------
    async handleCommand(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (!command) {
            logger.warn(`Unknown command: ${interaction.commandName}`);
            // Acknowledge so Discord doesn't show "application did not respond"
            const payload = { content: '❌ هذا الأمر غير متاح حالياً', ephemeral: true };
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(payload);
                }
                else {
                    await interaction.reply(payload);
                }
            }
            catch {
                // interaction expired or already handled elsewhere
            }
            return;
        }
        // Cooldown check
        if (command.cooldown && !this.checkCooldown(interaction.user.id, command)) {
            const cooldownTime = this.getCooldownRemaining(interaction.user.id, command);
            await interaction.reply({
                content: `⏳ يرجى الانتظار **${Math.ceil(cooldownTime / 1000)} ثانية** قبل استخدام الأمر مجدداً`,
                ephemeral: true,
            });
            return;
        }
        // Owner only check
        if (command.ownerOnly && !(await (0, botOwner_1.isBotOwner)(this.client, interaction.user.id))) {
            await interaction.reply({
                content: '❌ هذا الأمر مخصص لمالك البوت فقط',
                ephemeral: true,
            });
            return;
        }
        // Permission check
        if (command.permissions && command.permissions.length > 0) {
            if (!interaction.inGuild()) {
                await interaction.reply({
                    content: '❌ هذا الأمر يعمل في السيرفر فقط',
                    ephemeral: true,
                });
                return;
            }
            const member = interaction.guild?.members.cache.get(interaction.user.id);
            if (!member) {
                await interaction.reply({
                    content: '❌ لم يتم العثور على العضو',
                    ephemeral: true,
                });
                return;
            }
            const hasPermission = command.permissions.every(perm => member.permissions.has(perm) || member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator));
            if (!hasPermission) {
                await interaction.reply({
                    content: '❌ ليس لديك الصلاحيات الكافية لاستخدام هذا الأمر',
                    ephemeral: true,
                });
                return;
            }
        }
        // Set cooldown
        if (command.cooldown) {
            this.setCooldown(interaction.user.id, command);
        }
        // Execute command
        try {
            await command.execute(interaction);
        }
        catch (error) {
            logger.error(`Error executing command ${interaction.commandName}:`, error);
            const errorReply = {
                content: '❌ حدث خطأ أثناء تنفيذ الأمر. يرجى المحاولة لاحقاً',
                ephemeral: true,
            };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorReply);
            }
            else {
                await interaction.reply(errorReply);
            }
        }
    }
    // --------------------------------------------
    // Handle Autocomplete
    // --------------------------------------------
    async handleAutocomplete(interaction) {
        const command = this.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) {
            return;
        }
        try {
            await command.autocomplete(interaction);
        }
        catch (error) {
            logger.error(`Error in autocomplete for ${interaction.commandName}:`, error);
        }
    }
    // --------------------------------------------
    // Cooldown Management
    // --------------------------------------------
    setCooldown(userId, command) {
        if (!this.cooldowns.has(command.data.name)) {
            this.cooldowns.set(command.data.name, new discord_js_1.Collection());
        }
        const timestamps = this.cooldowns.get(command.data.name);
        timestamps.set(userId, Date.now());
    }
    checkCooldown(userId, command) {
        if (!command.cooldown)
            return true;
        if (!this.cooldowns.has(command.data.name)) {
            this.cooldowns.set(command.data.name, new discord_js_1.Collection());
        }
        const timestamps = this.cooldowns.get(command.data.name);
        const now = Date.now();
        const cooldownAmount = command.cooldown * 1000;
        if (timestamps.has(userId)) {
            const expirationTime = timestamps.get(userId) + cooldownAmount;
            if (now < expirationTime) {
                return false;
            }
        }
        return true;
    }
    getCooldownRemaining(userId, command) {
        const timestamps = this.cooldowns.get(command.data.name);
        if (!timestamps || !timestamps.has(userId))
            return 0;
        const expirationTime = timestamps.get(userId) + (command.cooldown * 1000);
        return Math.max(0, expirationTime - Date.now());
    }
    // --------------------------------------------
    // Getters
    // --------------------------------------------
    getCommands() {
        return this.commands;
    }
    getCommand(name) {
        return this.commands.get(name);
    }
    getCommandsByCategory(category) {
        return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
    }
    getCategories() {
        const categories = new Set();
        this.commands.forEach(cmd => {
            if (cmd.category)
                categories.add(cmd.category);
        });
        return Array.from(categories);
    }
}
exports.CommandHandler = CommandHandler;
exports.default = CommandHandler;
//# sourceMappingURL=CommandHandler.js.map