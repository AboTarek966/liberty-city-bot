// ============================================
// Omni Bot - متجر البروجيكتات (زر رجوع للمتجر)
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getStore, buildStoreEmbed, buildStoreSelect } from '../../utils/store';

const handler: ButtonHandler = {
  id: 'store:back',
  async execute(interaction: ButtonInteraction) {
    const store = await getStore();
    if (!store) {
      await interaction.reply({
        content: '❌ تعذر فتح المتجر حالياً — حاول لاحقاً',
        ephemeral: true,
      });
      return;
    }
    const components = buildStoreSelect(store) ?? [];
    const embed = buildStoreEmbed(store);
    await interaction.update({ embeds: [embed], components });
  },
};

export default handler;
