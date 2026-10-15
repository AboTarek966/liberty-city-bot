// ============================================
// Liberty City Bot - Sticker Delete Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'guildStickerDelete',
  async execute(sticker: any) {
    const client = sticker.client as LibertyClient;
    await client.securityHandler.onGuildStickerDelete(sticker).catch(() => {});
  },
};

export default event;