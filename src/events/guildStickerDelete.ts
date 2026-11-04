// ============================================
// Omni Bot - Sticker Delete Protection
// ============================================

import { Event } from '../handlers/EventHandler';
import { OmniClient } from '../OmniClient';

const event: Event = {
  name: 'guildStickerDelete',
  async execute(sticker: any) {
    const client = sticker.client as OmniClient;
    await client.securityHandler.onGuildStickerDelete(sticker).catch(() => {});
  },
};

export default event;