// ============================================
// Liberty City Bot - Event Handler
// ============================================

import { Client, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/helpers';

const logger = createLogger('EventHandler');

// --------------------------------------------
// Types
// --------------------------------------------
export interface Event {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export class EventHandler {
  private client: Client;
  private events: Collection<string, Event>;

  constructor(client: Client) {
    this.client = client;
    this.events = new Collection();
  }

  // --------------------------------------------
  // Load Events
  // --------------------------------------------
  async loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, '../events');

    if (!fs.existsSync(eventsPath)) {
      logger.warn('Events directory not found');
      return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => (file.endsWith('.js') && !file.endsWith('.d.js')));

    let loadedCount = 0;

    for (const file of eventFiles) {
      try {
        const filePath = path.join(eventsPath, file);
        const eventModule = require(filePath);
        const event: Event = eventModule.default || eventModule;

        if (!event.name || !event.execute) {
          logger.warn(`Event file ${file} is missing name or execute`);
          continue;
        }

        this.events.set(event.name, event);

        if (event.once) {
          this.client.once(event.name, (...args) => event.execute(...args));
        } else {
          this.client.on(event.name, (...args) => event.execute(...args));
        }

        loadedCount++;
        logger.debug(`Loaded event: ${event.name} ${event.once ? '(once)' : ''}`);
      } catch (error) {
        logger.error(`Failed to load event ${file}:`, error);
      }
    }

    logger.info(`Loaded ${loadedCount} events`);
  }

  // --------------------------------------------
  // Register Custom Event Listener
  // --------------------------------------------
  registerEvent(event: Event): void {
    if (this.events.has(event.name)) {
      logger.warn(`Event ${event.name} already registered, overwriting`);
    }

    this.events.set(event.name, event);

    if (event.once) {
      this.client.once(event.name, (...args) => event.execute(...args));
    } else {
      this.client.on(event.name, (...args) => event.execute(...args));
    }

    logger.debug(`Registered custom event: ${event.name}`);
  }

  // --------------------------------------------
  // Emit Custom Event
  // --------------------------------------------
  async emitEvent(name: string, ...args: any[]): Promise<void> {
    const event = this.events.get(name);
    if (event) {
      await event.execute(...args);
    }
  }

  // --------------------------------------------
  // Getters
  // --------------------------------------------
  getEvents(): Collection<string, Event> {
    return this.events;
  }

  getEvent(name: string): Event | undefined {
    return this.events.get(name);
  }
}

export default EventHandler;