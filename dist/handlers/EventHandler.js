"use strict";
// ============================================
// Liberty City Bot - Event Handler
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHandler = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('EventHandler');
class EventHandler {
    client;
    events;
    constructor(client) {
        this.client = client;
        this.events = new discord_js_1.Collection();
    }
    // --------------------------------------------
    // Load Events
    // --------------------------------------------
    async loadEvents() {
        const eventsPath = path_1.default.join(__dirname, '../events');
        if (!fs_1.default.existsSync(eventsPath)) {
            logger.warn('Events directory not found');
            return;
        }
        const eventFiles = fs_1.default.readdirSync(eventsPath).filter(file => (file.endsWith('.js') && !file.endsWith('.d.js')));
        let loadedCount = 0;
        for (const file of eventFiles) {
            try {
                const filePath = path_1.default.join(eventsPath, file);
                const eventModule = require(filePath);
                const event = eventModule.default || eventModule;
                if (!event.name || !event.execute) {
                    logger.warn(`Event file ${file} is missing name or execute`);
                    continue;
                }
                this.events.set(event.name, event);
                if (event.once) {
                    this.client.once(event.name, (...args) => event.execute(...args));
                }
                else {
                    this.client.on(event.name, (...args) => event.execute(...args));
                }
                loadedCount++;
                logger.debug(`Loaded event: ${event.name} ${event.once ? '(once)' : ''}`);
            }
            catch (error) {
                logger.error(`Failed to load event ${file}:`, error);
            }
        }
        logger.info(`Loaded ${loadedCount} events`);
    }
    // --------------------------------------------
    // Register Custom Event Listener
    // --------------------------------------------
    registerEvent(event) {
        if (this.events.has(event.name)) {
            logger.warn(`Event ${event.name} already registered, overwriting`);
        }
        this.events.set(event.name, event);
        if (event.once) {
            this.client.once(event.name, (...args) => event.execute(...args));
        }
        else {
            this.client.on(event.name, (...args) => event.execute(...args));
        }
        logger.debug(`Registered custom event: ${event.name}`);
    }
    // --------------------------------------------
    // Emit Custom Event
    // --------------------------------------------
    async emitEvent(name, ...args) {
        const event = this.events.get(name);
        if (event) {
            await event.execute(...args);
        }
    }
    // --------------------------------------------
    // Getters
    // --------------------------------------------
    getEvents() {
        return this.events;
    }
    getEvent(name) {
        return this.events.get(name);
    }
}
exports.EventHandler = EventHandler;
exports.default = EventHandler;
//# sourceMappingURL=EventHandler.js.map