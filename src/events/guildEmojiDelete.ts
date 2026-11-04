// ============================================
// Omni Bot - Emoji Delete Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'guildEmojiDelete',
  async execute(emoji: any) {
    const client = emoji.client as OmniClient;
    await client.securityHandler.onGuildEmojiDelete(emoji).catch(() => {});
  },
};

export default event;