// ============================================
// Liberty City Bot - Alias Clear Buttons
// أزرار تأكيد/إلغاء حذف جميع الاختصارات (/alias clear)
// ============================================

import {
  ButtonInteraction,
  MessageFlags,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { CommandAlias } from '../../models';
import { invalidateAliasCache } from '../../utils/aliasCache';

const handler: ButtonHandler = {
  id: 'alias:clear',
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split(':'); // alias:clear:confirm|cancel:userId
    const action = parts[2];
    const ownerId = parts[3];

    // 🔒 الزر مخصص لمن أطلق الأمر فقط
    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: '❌ هذا التأكيد مخصص لمن أطلق الأمر فقط',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (action === 'cancel') {
      await interaction.update({ content: '✅ تم إلغاء الحذف — الاختصارات كما هي', components: [] });
      return;
    }

    if (action === 'confirm') {
      const result = await CommandAlias.deleteMany({ guildId: interaction.guildId! });
      invalidateAliasCache(interaction.guildId!);

      await interaction.update({
        content: `🗑️ تم حذف **${result.deletedCount}** اختصار بنجاح`,
        components: [],
      });
      return;
    }

    await interaction.update({ components: [] });
  },
};

export default handler;
