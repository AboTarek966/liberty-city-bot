// ============================================
// Liberty City Bot - Alias Pick (قائمة اختيار الاختصار المتعدد)
// تظهر عندما يكون الاختصار مرتبطاً بأكثر من أمر غير متكامل
// ============================================

import { StringSelectMenuInteraction } from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { handleAliasPickSelect } from '../../events/messageCreate';

const handler: SelectMenuHandler = {
  id: 'alias_pick',
  async execute(interaction) {
    const sel = interaction as StringSelectMenuInteraction;
    if (!sel.guild) {
      await sel.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true }).catch(() => {});
      return;
    }

    const sid = sel.customId.split(':')[1];
    await handleAliasPickSelect(sel, sid);
  },
};

export default handler;
