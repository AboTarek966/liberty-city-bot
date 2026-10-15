// ============================================
// Liberty City Bot - Emoji Delete Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildEmojiDelete',
  async execute(emoji: any) {
    const client = emoji.client as LibertyClient;
    await client.securityHandler.onGuildEmojiDelete(emoji).catch(() => {});
  },
};

export default event;