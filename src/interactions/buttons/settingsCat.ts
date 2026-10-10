// ============================================
// Settings Panel - Category Navigation Button
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { buildPanel, canManageSettings, SettingsCategory } from '../../utils/settingsPanel';

const handler: ButtonHandler = {
  id: 'settings_cat',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الزر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    if (!canManageSettings(interaction as any)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }

    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل

    const category = (interaction.customId.split(':')[1] || 'home') as SettingsCategory;
    const panel = await buildPanel(category, interaction.guild, interaction.user.id);

    await interaction.editReply({
      embeds: panel.embeds,
      components: panel.components as any,
    });
  },
};

export default handler;
