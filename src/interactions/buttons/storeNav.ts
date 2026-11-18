// ============================================
// Omni Bot - 🛍️ متجر Omni (التنقل بين الأقسام والصفحات)
// customId: store:nav:<all|type>:<page>
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import {
  getStore,
  buildStoreEmbed,
  buildStoreComponents,
  normalizeStoreFilter,
  normalizeStoreType,
} from '../../utils/store';

const handler: ButtonHandler = {
  id: 'store:nav',
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split(':');
    const filter = normalizeStoreFilter(parts[2]);
    const page = Number(parts[3]) || 0;

    const store = await getStore();
    if (!store) {
      await interaction.reply({ content: '❌ تعذر فتح المتجر حالياً — حاول لاحقاً', ephemeral: true });
      return;
    }

    const view = { type: filter === 'all' ? 'all' : normalizeStoreType(filter), page };
    const components = buildStoreComponents(store, view);
    const embed = buildStoreEmbed(store, view);

    await interaction.update({ embeds: [embed], components });
  },
};

export default handler;
